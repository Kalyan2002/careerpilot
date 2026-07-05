-- CreateTable
CREATE TABLE "Application" (
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
    "runId" TEXT,
    "normalizedTitle" TEXT NOT NULL,
    "normalizedCompany" TEXT NOT NULL,
    CONSTRAINT "Application_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("runId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StageEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "applicationId" INTEGER NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "note" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StageEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    CONSTRAINT "Credential_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" DATETIME,
    "scope" TEXT,
    "historyId" TEXT,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailAccount_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "providerId" TEXT NOT NULL,
    "threadId" TEXT,
    "subject" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "fromDomain" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "rawBody" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scannedAt" DATETIME,
    "classification" TEXT,
    "confidence" REAL,
    "reasoning" TEXT,
    "matchedAppId" INTEGER,
    "matchScore" REAL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "appliedStage" TEXT,
    "verificationCode" TEXT,
    "verificationLink" TEXT,
    "verificationDomain" TEXT,
    CONSTRAINT "EmailMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EmailAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailMessage_matchedAppId_fkey" FOREIGN KEY ("matchedAppId") REFERENCES "Application" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobBoard" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "searchUrl" TEXT,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT,
    "password" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "JobBoard_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "linkedin" TEXT,
    "github" TEXT,
    "street" TEXT,
    "aptUnit" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "usAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "requiresSponsorship" BOOLEAN NOT NULL DEFAULT false,
    "visaStatus" TEXT,
    "optExtension" TEXT,
    "willingToRelocate" BOOLEAN NOT NULL DEFAULT false,
    "preferredLocations" TEXT NOT NULL DEFAULT '[]',
    "eeoGender" TEXT,
    "eeoRace" TEXT,
    "eeoEthnicity" TEXT,
    "eeoHispanicOrLatino" TEXT,
    "eeoVeteranStatus" TEXT,
    "eeoDisabilityStatus" TEXT,
    "primaryResumeId" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_primaryResumeId_fkey" FOREIGN KEY ("primaryResumeId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutopilotSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "minMatchScore" INTEGER NOT NULL DEFAULT 70,
    "maxApplicationsPerRun" INTEGER NOT NULL DEFAULT 20,
    "confirmMode" TEXT NOT NULL DEFAULT 'batch',
    "skipCompanies" TEXT NOT NULL DEFAULT '[]',
    "skipTitleKeywords" TEXT NOT NULL DEFAULT '[]',
    "minSalary" INTEGER NOT NULL DEFAULT 0,
    "maxSalary" INTEGER NOT NULL DEFAULT 0,
    "salaryExpectation" TEXT,
    "defaultStartDate" TEXT NOT NULL DEFAULT '2 weeks notice',
    CONSTRAINT "AutopilotSettings_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" DATETIME,
    CONSTRAINT "QueueEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "sourceFilename" TEXT,
    "sourceMimeType" TEXT,
    "sourceSizeBytes" INTEGER,
    "content" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Resume_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResumeVariant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "resumeId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "jobUrl" TEXT,
    "applicationId" INTEGER,
    "content" TEXT NOT NULL,
    "diffNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResumeVariant_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResumeVariant_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Run" (
    "runId" TEXT NOT NULL PRIMARY KEY,
    "profileId" INTEGER NOT NULL,
    "query" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "config" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "Run_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunJob" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runId" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
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
    CONSTRAINT "RunJob_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("runId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("runId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Application_profileId_idx" ON "Application"("profileId");

-- CreateIndex
CREATE INDEX "Application_normalizedTitle_normalizedCompany_idx" ON "Application"("normalizedTitle", "normalizedCompany");

-- CreateIndex
CREATE INDEX "Application_appliedAt_idx" ON "Application"("appliedAt");

-- CreateIndex
CREATE INDEX "Application_runId_idx" ON "Application"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_profileId_url_key" ON "Application"("profileId", "url");

-- CreateIndex
CREATE INDEX "StageEvent_applicationId_occurredAt_idx" ON "StageEvent"("applicationId", "occurredAt");

-- CreateIndex
CREATE INDEX "Credential_profileId_idx" ON "Credential"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Credential_profileId_scope_key" ON "Credential"("profileId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAccount_profileId_key" ON "EmailAccount"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_providerId_key" ON "EmailMessage"("providerId");

-- CreateIndex
CREATE INDEX "EmailMessage_reviewStatus_receivedAt_idx" ON "EmailMessage"("reviewStatus", "receivedAt");

-- CreateIndex
CREATE INDEX "EmailMessage_matchedAppId_idx" ON "EmailMessage"("matchedAppId");

-- CreateIndex
CREATE INDEX "EmailMessage_fromDomain_receivedAt_idx" ON "EmailMessage"("fromDomain", "receivedAt");

-- CreateIndex
CREATE INDEX "EmailMessage_verificationDomain_receivedAt_idx" ON "EmailMessage"("verificationDomain", "receivedAt");

-- CreateIndex
CREATE INDEX "JobBoard_profileId_idx" ON "JobBoard"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "JobBoard_profileId_domain_key" ON "JobBoard"("profileId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_primaryResumeId_key" ON "Profile"("primaryResumeId");

-- CreateIndex
CREATE INDEX "Profile_isActive_idx" ON "Profile"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AutopilotSettings_profileId_key" ON "AutopilotSettings"("profileId");

-- CreateIndex
CREATE INDEX "QueueEntry_profileId_status_idx" ON "QueueEntry"("profileId", "status");

-- CreateIndex
CREATE INDEX "QueueEntry_status_idx" ON "QueueEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_profileId_url_key" ON "QueueEntry"("profileId", "url");

-- CreateIndex
CREATE INDEX "Resume_profileId_idx" ON "Resume"("profileId");

-- CreateIndex
CREATE INDEX "ResumeVariant_resumeId_idx" ON "ResumeVariant"("resumeId");

-- CreateIndex
CREATE INDEX "ResumeVariant_applicationId_idx" ON "ResumeVariant"("applicationId");

-- CreateIndex
CREATE INDEX "Run_profileId_idx" ON "Run"("profileId");

-- CreateIndex
CREATE INDEX "RunJob_runId_status_idx" ON "RunJob"("runId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RunJob_runId_jobKey_key" ON "RunJob"("runId", "jobKey");

-- CreateIndex
CREATE INDEX "RunEvent_runId_createdAt_idx" ON "RunEvent"("runId", "createdAt");
