import "server-only";
import { gmailProvider, scopeCanSend } from "./gmail";
import type { EmailProvider } from "./provider";

export function getProvider(name: string): EmailProvider {
  if (name === "gmail") {
    return gmailProvider;
  }
  throw new Error(`Unsupported email provider: ${name}`);
}

/** Whether the account's stored scope permits sending (currently Gmail-only). */
export function accountCanSend(account: { provider: string; scope: string | null }): boolean {
  if (account.provider === "gmail") {
    return scopeCanSend(account.scope);
  }
  return false;
}

export type {
  EmailProvider,
  NormalizedMessage,
  OutboundAttachment,
  SendMessageInput,
  SentMessage,
  SyncResult,
  TokenSet,
} from "./provider";
