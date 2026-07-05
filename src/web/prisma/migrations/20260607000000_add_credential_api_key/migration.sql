-- Make Credential.email/password nullable and add Credential.apiKey (for service API keys
-- like 2captcha / capsolver, stored as a row whose scope is the provider name).
-- RedefineTable (SQLite has no ALTER COLUMN); data-preserving.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Credential" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "apiKey" TEXT,
    CONSTRAINT "Credential_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Credential" ("id", "profileId", "scope", "email", "password") SELECT "id", "profileId", "scope", "email", "password" FROM "Credential";
DROP TABLE "Credential";
ALTER TABLE "new_Credential" RENAME TO "Credential";
CREATE INDEX "Credential_profileId_idx" ON "Credential"("profileId");
CREATE UNIQUE INDEX "Credential_profileId_scope_key" ON "Credential"("profileId", "scope");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
