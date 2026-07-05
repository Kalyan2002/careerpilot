import { Prisma } from "@/generated/prisma/client";
import { decryptSecret, encryptSecret } from "./crypto";

/** Model -> field names that must be encrypted at rest. */
const ENCRYPTED_FIELDS: Record<string, readonly string[]> = {
  Credential: ["password", "apiKey"],
  JobBoard: ["password"],
  EmailAccount: ["accessToken", "refreshToken"],
};

function encryptData(model: string, data: unknown): unknown {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields || !data || typeof data !== "object") return data;
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const field of fields) {
    const value = out[field];
    if (typeof value === "string" && value.length > 0) {
      out[field] = encryptSecret(value);
    }
  }
  return out;
}

function decryptResult(model: string, result: unknown): unknown {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields || !result || typeof result !== "object") return result;
  if (Array.isArray(result)) {
    return result.map((row) => decryptResult(model, row));
  }
  const out: Record<string, unknown> = { ...(result as Record<string, unknown>) };
  for (const field of fields) {
    const value = out[field];
    if (typeof value === "string" && value.length > 0) {
      out[field] = decryptSecret(value);
    }
  }
  return out;
}

/**
 * Prisma Client Extension: transparently encrypts Credential/JobBoard/EmailAccount
 * secret columns on write and decrypts on read, so every existing call site
 * (resolveCredential, route handlers, email sync) keeps working unmodified.
 */
export const encryptedFieldsExtension = Prisma.defineExtension({
  name: "encrypted-fields",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (
          args &&
          typeof args === "object" &&
          "data" in args &&
          (operation === "create" || operation === "update")
        ) {
          (args as { data: unknown }).data = encryptData(model, (args as { data: unknown }).data);
        }
        if (
          args &&
          typeof args === "object" &&
          "create" in args &&
          "update" in args &&
          operation === "upsert"
        ) {
          const upsertArgs = args as { create: unknown; update: unknown };
          upsertArgs.create = encryptData(model, upsertArgs.create);
          upsertArgs.update = encryptData(model, upsertArgs.update);
        }

        const result = await query(args);
        return decryptResult(model, result);
      },
    },
  },
});
