-- Redesign search & autopilot: drop board type/enabled, drop autopilot guardrails, make maxApplicationsPerRun optional.
-- SQLite requires table rewrites for column drops and nullability changes.

PRAGMA foreign_keys=OFF;

-- RedefineTable: JobBoard (drop type, enabled)
CREATE TABLE "new_JobBoard" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "searchUrl" TEXT,
    "email" TEXT,
    "password" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "JobBoard_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_JobBoard" ("id", "profileId", "name", "domain", "searchUrl", "email", "password", "sortOrder")
SELECT "id", "profileId", "name", "domain", "searchUrl", "email", "password", "sortOrder" FROM "JobBoard";
DROP TABLE "JobBoard";
ALTER TABLE "new_JobBoard" RENAME TO "JobBoard";
CREATE INDEX "JobBoard_profileId_idx" ON "JobBoard"("profileId");
CREATE UNIQUE INDEX "JobBoard_profileId_domain_key" ON "JobBoard"("profileId", "domain");

-- RedefineTable: AutopilotSettings (drop confirmMode, skipCompanies, skipTitleKeywords, minSalary, maxSalary, salaryExpectation; make maxApplicationsPerRun nullable)
CREATE TABLE "new_AutopilotSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "minMatchScore" INTEGER NOT NULL DEFAULT 70,
    "maxApplicationsPerRun" INTEGER,
    "defaultStartDate" TEXT NOT NULL DEFAULT '2 weeks notice',
    CONSTRAINT "AutopilotSettings_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AutopilotSettings" ("id", "profileId", "minMatchScore", "maxApplicationsPerRun", "defaultStartDate")
SELECT "id", "profileId", "minMatchScore", "maxApplicationsPerRun", "defaultStartDate" FROM "AutopilotSettings";
DROP TABLE "AutopilotSettings";
ALTER TABLE "new_AutopilotSettings" RENAME TO "AutopilotSettings";
CREATE UNIQUE INDEX "AutopilotSettings_profileId_key" ON "AutopilotSettings"("profileId");

PRAGMA foreign_keys=ON;
