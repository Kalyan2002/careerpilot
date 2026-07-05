import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { encryptedFieldsExtension } from "@/server/security/encrypted-fields";

const dbPath = path.resolve(process.cwd(), "prisma", "app.db");

function createClient() {
  return new PrismaClient({
    adapter: new PrismaLibSql({ url: `file:${dbPath}` }),
  }).$extends(encryptedFieldsExtension);
}

type ExtendedPrismaClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: ExtendedPrismaClient;
};

export const db: ExtendedPrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/**
 * Accepts either `db` itself or the `tx` passed into `db.$transaction(async (tx) => ...)`.
 * Derived from `db`'s own `$transaction` signature (rather than the generated
 * `Prisma.TransactionClient`) so it stays correct for the encrypted-fields-extended
 * client instead of the pre-extension base type.
 */
export type TransactionClient = Parameters<Parameters<ExtendedPrismaClient["$transaction"]>[0]>[0];
