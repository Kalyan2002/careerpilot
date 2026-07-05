import type { QueueStatus } from "@/api/contracts/queue";

export interface QueueEntryDto {
  id: number;
  url: string;
  note: string | null;
  status: QueueStatus;
  createdAt: string;
  consumedAt: string | null;
}
