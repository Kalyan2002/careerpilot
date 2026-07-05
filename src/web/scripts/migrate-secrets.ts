/**
 * One-time (idempotent) migration: re-saves every Credential/JobBoard/EmailAccount
 * secret field through the encrypted-fields Prisma extension so existing plaintext
 * rows (e.g. carried over from a pre-encryption app.db) get encrypted at rest.
 * Safe to re-run - rows already encrypted are just re-encrypted with a fresh IV.
 */
import { db } from "../src/server/db";

async function run() {
  const credentials = await db.credential.findMany();
  for (const c of credentials) {
    if (!c.password && !c.apiKey) continue;
    await db.credential.update({
      where: { id: c.id },
      data: { password: c.password, apiKey: c.apiKey },
    });
  }
  console.log(`Re-encrypted ${credentials.length} credential row(s).`);

  const boards = await db.jobBoard.findMany();
  let boardCount = 0;
  for (const b of boards) {
    if (!b.password) continue;
    await db.jobBoard.update({ where: { id: b.id }, data: { password: b.password } });
    boardCount++;
  }
  console.log(`Re-encrypted ${boardCount} job board row(s).`);

  const accounts = await db.emailAccount.findMany();
  for (const a of accounts) {
    if (!a.accessToken && !a.refreshToken) continue;
    await db.emailAccount.update({
      where: { id: a.id },
      data: { accessToken: a.accessToken, refreshToken: a.refreshToken },
    });
  }
  console.log(`Re-encrypted ${accounts.length} email account row(s).`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
