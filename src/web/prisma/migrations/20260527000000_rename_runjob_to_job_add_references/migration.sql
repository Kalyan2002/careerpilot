-- Rename RunJob -> Job and its "job"-prefixed columns (data-preserving).
ALTER TABLE "RunJob" RENAME TO "Job";
ALTER TABLE "Job" RENAME COLUMN "jobKey" TO "key";
ALTER TABLE "Job" RENAME COLUMN "jobDigest" TO "digest";

-- Re-create indexes under the new table name.
DROP INDEX "RunJob_runId_status_idx";
CREATE INDEX "Job_runId_status_idx" ON "Job"("runId", "status");
DROP INDEX "RunJob_runId_jobKey_key";
CREATE UNIQUE INDEX "Job_runId_key_key" ON "Job"("runId", "key");

-- CreateTable
CREATE TABLE "Reference" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Reference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Reference_profileId_idx" ON "Reference"("profileId");
