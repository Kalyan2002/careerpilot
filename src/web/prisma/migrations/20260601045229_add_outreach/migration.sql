-- CreateTable
CREATE TABLE "Contact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "linkedinUrl" TEXT,
    "email" TEXT,
    "emailSource" TEXT,
    "emailConfidence" REAL,
    "linkedinConnection" TEXT NOT NULL DEFAULT 'none',
    "discoverySource" TEXT,
    "matchConfidence" REAL,
    "relatedAppId" INTEGER,
    "relatedJobUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contact_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contact_relatedAppId_fkey" FOREIGN KEY ("relatedAppId") REFERENCES "Application" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutreachMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "runId" TEXT,
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
    CONSTRAINT "OutreachMessage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("runId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Contact_profileId_idx" ON "Contact"("profileId");

-- CreateIndex
CREATE INDEX "Contact_profileId_company_idx" ON "Contact"("profileId", "company");

-- CreateIndex
CREATE INDEX "OutreachMessage_profileId_idx" ON "OutreachMessage"("profileId");

-- CreateIndex
CREATE INDEX "OutreachMessage_runId_idx" ON "OutreachMessage"("runId");

-- CreateIndex
CREATE INDEX "OutreachMessage_contactId_idx" ON "OutreachMessage"("contactId");

-- CreateIndex
CREATE INDEX "OutreachMessage_threadId_idx" ON "OutreachMessage"("threadId");

-- CreateIndex
CREATE INDEX "OutreachMessage_status_idx" ON "OutreachMessage"("status");
