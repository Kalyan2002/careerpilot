import { z } from "zod/v4";
import type { Prisma } from "@/generated/prisma/client";
import { api } from "@/server/api/route";
import { db } from "@/server/db";

const querySchema = z.object({
  stage: z.string().trim().min(1).optional(),
  board: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

export const GET = api.route({ query: querySchema }, ({ query, profileId }) => {
  const { stage, board, source, search } = query;

  const where: Prisma.ApplicationWhereInput = { profileId };

  if (stage) {
    where.stage = stage;
  }
  if (board) {
    where.board = board;
  }
  if (source) {
    where.source = source;
  }
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { company: { contains: search } },
      { url: { contains: search } },
    ];
  }

  return db.application.findMany({
    where,
    orderBy: { appliedAt: "desc" },
    take: 500,
  });
});
