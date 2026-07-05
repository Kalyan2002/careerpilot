-- Rename Run -> Campaign (and RunEvent -> CampaignEvent), data-preserving.
-- The primary key `runId` -> `campaignId` is referenced by FKs across
-- Job/Application/OutreachMessage, so each affected table is rebuilt.
-- We never `RENAME` an *existing* table that other tables reference (modern
-- SQLite rewrites dependents' FK clauses on rename); instead we build a
-- `new_*` table, drop the original, and rename the new one into place — the
-- pattern Prisma itself uses for table redefinitions.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Run -> Campaign (name change: create + copy + drop)
CREATE TABLE "Campaign" (
    "campaignId" TEXT NOT NULL PRIMARY KEY,
    "profileId" INTEGER NOT NULL,
    "query" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "config" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "Campaign_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "Campaign" ("campaignId", "profileId", "query", "source", "status", "startedAt", "updatedAt", "completedAt", "config", "summary")
SELECT "runId", "profileId", "query", "source", "status", "startedAt", "updatedAt", "completedAt", "config", "summary" FROM "Run";

-- RunEvent -> CampaignEvent
CREATE TABLE "CampaignEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("campaignId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "CampaignEvent" ("id", "campaignId", "type", "payload", "createdAt")
SELECT "id", "runId", "type", "payload", "createdAt" FROM "RunEvent";
DROP TABLE "RunEvent";
DROP TABLE "Run";
CREATE INDEX "Campaign_profileId_idx" ON "Campaign"("profileId");
CREATE INDEX "CampaignEvent_campaignId_createdAt_idx" ON "CampaignEvent"("campaignId", "createdAt");

-- Job: runId -> campaignId (no dependents, but use the safe rebuild pattern)
CREATE TABLE "new_Job" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "salary" TEXT,
    "type" TEXT,
    "url" TEXT NOT NULL,
    "board" TEXT,
    "matchScore" INTEGER,
    "matchReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "appliedAt" DATETIME,
    "failReason" TEXT,
    "retryNotes" TEXT,
    "skipReason" TEXT,
    "description" TEXT,
    "digest" TEXT,
    CONSTRAINT "Job_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("campaignId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("id", "campaignId", "key", "title", "company", "location", "salary", "type", "url", "board", "matchScore", "matchReason", "status", "appliedAt", "failReason", "retryNotes", "skipReason", "description", "digest")
SELECT "id", "runId", "key", "title", "company", "location", "salary", "type", "url", "board", "matchScore", "matchReason", "status", "appliedAt", "failReason", "retryNotes", "skipReason", "description", "digest" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE INDEX "Job_campaignId_status_idx" ON "Job"("campaignId", "status");
CREATE UNIQUE INDEX "Job_campaignId_key_key" ON "Job"("campaignId", "key");

-- Application: runId -> campaignId (referenced by Contact/EmailMessage/ResumeVariant/StageEvent)
CREATE TABLE "new_Application" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "board" TEXT,
    "source" TEXT NOT NULL,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stage" TEXT NOT NULL DEFAULT 'applied',
    "outcome" TEXT,
    "rejectedAt" DATETIME,
    "matchScore" INTEGER,
    "matchReason" TEXT,
    "failReason" TEXT,
    "campaignId" TEXT,
    "normalizedTitle" TEXT NOT NULL,
    "normalizedCompany" TEXT NOT NULL,
    CONSTRAINT "Application_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("campaignId") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Application" ("id", "profileId", "url", "title", "company", "location", "board", "source", "appliedAt", "stage", "outcome", "rejectedAt", "matchScore", "matchReason", "failReason", "campaignId", "normalizedTitle", "normalizedCompany")
SELECT "id", "profileId", "url", "title", "company", "location", "board", "source", "appliedAt", "stage", "outcome", "rejectedAt", "matchScore", "matchReason", "failReason", "runId", "normalizedTitle", "normalizedCompany" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
CREATE INDEX "Application_profileId_idx" ON "Application"("profileId");
CREATE INDEX "Application_normalizedTitle_normalizedCompany_idx" ON "Application"("normalizedTitle", "normalizedCompany");
CREATE INDEX "Application_appliedAt_idx" ON "Application"("appliedAt");
CREATE INDEX "Application_campaignId_idx" ON "Application"("campaignId");
CREATE UNIQUE INDEX "Application_profileId_url_key" ON "Application"("profileId", "url");

-- OutreachMessage: runId -> campaignId
CREATE TABLE "new_OutreachMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "campaignId" TEXT,
    "channel" TEXT NOT NULL,
    "linkedinKind" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "failReason" TEXT,
    "providerId" TEXT,
    "threadId" TEXT,
    "sentAt" DATETIME,
    "repliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutreachMessage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutreachMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutreachMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("campaignId") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OutreachMessage" ("id", "profileId", "contactId", "campaignId", "channel", "linkedinKind", "subject", "body", "status", "failReason", "providerId", "threadId", "sentAt", "repliedAt", "createdAt", "updatedAt")
SELECT "id", "profileId", "contactId", "runId", "channel", "linkedinKind", "subject", "body", "status", "failReason", "providerId", "threadId", "sentAt", "repliedAt", "createdAt", "updatedAt" FROM "OutreachMessage";
DROP TABLE "OutreachMessage";
ALTER TABLE "new_OutreachMessage" RENAME TO "OutreachMessage";
CREATE INDEX "OutreachMessage_profileId_idx" ON "OutreachMessage"("profileId");
CREATE INDEX "OutreachMessage_campaignId_idx" ON "OutreachMessage"("campaignId");
CREATE INDEX "OutreachMessage_contactId_idx" ON "OutreachMessage"("contactId");
CREATE INDEX "OutreachMessage_threadId_idx" ON "OutreachMessage"("threadId");
CREATE INDEX "OutreachMessage_status_idx" ON "OutreachMessage"("status");

-- AutoApplySettings: maxApplicationsPerRun -> maxApplicationsPerCampaign
CREATE TABLE "new_AutoApplySettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "minMatchScore" INTEGER NOT NULL DEFAULT 70,
    "maxApplicationsPerCampaign" INTEGER,
    "defaultStartDate" TEXT NOT NULL DEFAULT '2 weeks notice',
    CONSTRAINT "AutoApplySettings_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AutoApplySettings" ("id", "profileId", "minMatchScore", "maxApplicationsPerCampaign", "defaultStartDate")
SELECT "id", "profileId", "minMatchScore", "maxApplicationsPerRun", "defaultStartDate" FROM "AutoApplySettings";
DROP TABLE "AutoApplySettings";
ALTER TABLE "new_AutoApplySettings" RENAME TO "AutoApplySettings";
CREATE UNIQUE INDEX "AutoApplySettings_profileId_key" ON "AutoApplySettings"("profileId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
