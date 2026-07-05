-- Rename "autopilot" to "auto-apply": run/application source values + the settings table.

-- Source values are plain String columns (no enum), so a plain UPDATE suffices.
UPDATE "Run" SET "source" = 'auto-apply' WHERE "source" = 'autopilot';
UPDATE "Application" SET "source" = 'auto-apply' WHERE "source" = 'autopilot';

-- Rename AutopilotSettings -> AutoApplySettings via table rewrite so the
-- index/FK constraint names match what Prisma expects for the new model.
PRAGMA foreign_keys=OFF;

CREATE TABLE "AutoApplySettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "minMatchScore" INTEGER NOT NULL DEFAULT 70,
    "maxApplicationsPerRun" INTEGER,
    "defaultStartDate" TEXT NOT NULL DEFAULT '2 weeks notice',
    CONSTRAINT "AutoApplySettings_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "AutoApplySettings" ("id", "profileId", "minMatchScore", "maxApplicationsPerRun", "defaultStartDate")
SELECT "id", "profileId", "minMatchScore", "maxApplicationsPerRun", "defaultStartDate" FROM "AutopilotSettings";
DROP TABLE "AutopilotSettings";
CREATE UNIQUE INDEX "AutoApplySettings_profileId_key" ON "AutoApplySettings"("profileId");

PRAGMA foreign_keys=ON;
