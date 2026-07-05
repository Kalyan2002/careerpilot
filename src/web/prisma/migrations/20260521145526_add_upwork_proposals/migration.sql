-- CreateTable
CREATE TABLE "UpworkProposal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "clientName" TEXT,
    "jobUrl" TEXT,
    "jobDescription" TEXT,
    "proposalText" TEXT NOT NULL DEFAULT '',
    "screeningAnswers" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "outcome" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "submittedAt" DATETIME,
    CONSTRAINT "UpworkProposal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UpworkProposal_profileId_idx" ON "UpworkProposal"("profileId");

-- CreateIndex
CREATE INDEX "UpworkProposal_profileId_status_idx" ON "UpworkProposal"("profileId", "status");
