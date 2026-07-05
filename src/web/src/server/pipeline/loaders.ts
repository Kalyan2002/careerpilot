import "server-only";
import { CAMPAIGN_JOB_TERMINAL_OUTCOMES } from "@/api/contracts/campaign";
import type { PipelineColumnPage, PipelineJobDto, PipelineStage } from "@/api/types/pipeline";
import { db } from "@/server/db";
import { mapApplication, mapCampaignJob, mapQueueEntry } from "./mappers";

/** Active board/campaign/search scoping applied to a pipeline column query. */
export interface PipelineFilters {
  search?: string | null;
  board?: string | null;
  campaignId?: string | null;
}

export function emptyPage(stage: PipelineStage): PipelineColumnPage {
  return { stage, items: [], nextCursor: null, total: 0, todayCount: 0 };
}

export async function loadQueued(
  profileId: number,
  cursor: number | null,
  limit: number,
  filters: PipelineFilters,
): Promise<PipelineColumnPage> {
  // Queued entries live in QueueEntry, which has no campaignId — a campaign scope can
  // never match them, so short-circuit (mirrors the board handling).
  if (filters.board || filters.campaignId) {
    return emptyPage("queued");
  }

  const baseWhere = { profileId, status: "pending" } as const;
  const searchWhere = filters.search
    ? {
        OR: [{ url: { contains: filters.search } }, { note: { contains: filters.search } }],
      }
    : {};

  const [items, total, todayCount] = await Promise.all([
    db.queueEntry.findMany({
      where: { ...baseWhere, ...withCursor(cursor), ...searchWhere },
      orderBy: { id: "desc" },
      take: limit + 1,
    }),
    db.queueEntry.count({ where: baseWhere }),
    db.queueEntry.count({ where: { ...baseWhere, createdAt: { gte: startOfToday() } } }),
  ]);

  return finalize("queued", items, total, todayCount, limit, mapQueueEntry);
}

export async function loadApplying(
  profileId: number,
  cursor: number | null,
  limit: number,
  filters: PipelineFilters,
): Promise<PipelineColumnPage> {
  const baseWhere = {
    campaign: { status: "in_progress", profileId },
    status: { notIn: [...CAMPAIGN_JOB_TERMINAL_OUTCOMES] },
    ...(filters.board ? { board: filters.board } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
  };
  const searchWhere = filters.search
    ? {
        OR: [{ title: { contains: filters.search } }, { company: { contains: filters.search } }],
      }
    : {};

  const [items, total, todayCount] = await Promise.all([
    db.job.findMany({
      where: { ...baseWhere, ...withCursor(cursor), ...searchWhere },
      orderBy: { id: "desc" },
      take: limit + 1,
    }),
    db.job.count({ where: baseWhere }),
    db.job.count({ where: { ...baseWhere, appliedAt: { gte: startOfToday() } } }),
  ]);

  return finalize("applying", items, total, todayCount, limit, mapCampaignJob);
}

export function loadSubmitted(
  profileId: number,
  cursor: number | null,
  limit: number,
  filters: PipelineFilters,
): Promise<PipelineColumnPage> {
  return loadApplicationStage(profileId, "submitted", "applied", cursor, limit, filters, {
    extraSearchFields: ["url"],
  });
}

export function loadInterviewing(
  profileId: number,
  cursor: number | null,
  limit: number,
  filters: PipelineFilters,
): Promise<PipelineColumnPage> {
  return loadApplicationStage(
    profileId,
    "interviewing",
    { notIn: ["applied", "rejected", "withdrawn"] },
    cursor,
    limit,
    filters,
  );
}

type ApplicationStageFilter = string | { notIn: string[] };

async function loadApplicationStage(
  profileId: number,
  stage: PipelineStage,
  stageFilter: ApplicationStageFilter,
  cursor: number | null,
  limit: number,
  filters: PipelineFilters,
  opts: { extraSearchFields?: "url"[] } = {},
): Promise<PipelineColumnPage> {
  const baseWhere = {
    profileId,
    stage: stageFilter,
    ...(filters.board ? { board: filters.board } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
  };
  const searchWhere = filters.search
    ? {
        OR: [
          { title: { contains: filters.search } },
          { company: { contains: filters.search } },
          ...(opts.extraSearchFields?.includes("url")
            ? [{ url: { contains: filters.search } }]
            : []),
        ],
      }
    : {};

  const [items, total, todayCount] = await Promise.all([
    db.application.findMany({
      where: { ...baseWhere, ...withCursor(cursor), ...searchWhere },
      orderBy: { id: "desc" },
      take: limit + 1,
    }),
    db.application.count({ where: baseWhere }),
    db.application.count({ where: { ...baseWhere, appliedAt: { gte: startOfToday() } } }),
  ]);

  return finalize(stage, items, total, todayCount, limit, (a) => mapApplication(a, stage));
}

function withCursor(cursor: number | null) {
  return cursor ? { id: { lt: cursor } } : {};
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function finalize<T extends { id: number }>(
  stage: PipelineStage,
  items: T[],
  total: number,
  todayCount: number,
  limit: number,
  map: (item: T) => PipelineJobDto,
): PipelineColumnPage {
  const hasNext = items.length > limit;
  const page = hasNext ? items.slice(0, limit) : items;
  return {
    stage,
    items: page.map(map),
    nextCursor: hasNext ? String(page[page.length - 1]!.id) : null,
    total,
    todayCount,
  };
}
