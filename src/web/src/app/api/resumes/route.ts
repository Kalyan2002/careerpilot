import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod/v4";
import { resumeDataSchema } from "@/api/contracts/resume";
import type { ResumeListItem } from "@/api/types";
import { MAX_RESUME_BYTES } from "@/lib/constants";
import { badRequest } from "@/server/api/errors";
import { api } from "@/server/api/route";
import { db } from "@/server/db";
import { ensureResumesDir, generateResumeFilename } from "@/server/storage";

export const GET = api.route({}, async ({ profileId }) => {
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { primaryResumeId: true },
  });
  const primaryId = profile?.primaryResumeId ?? null;

  const resumes = await db.resume.findMany({
    where: { profileId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { variants: true } } },
  });

  const items: ResumeListItem[] = resumes
    .map((r) => ({
      id: r.id,
      label: r.label,
      sourceFilename: r.sourceFilename,
      hasData: r.content !== null,
      variantCount: r._count.variants,
      isPrimary: r.id === primaryId,
      updatedAt: r.updatedAt.toISOString(),
    }))
    .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));

  return items;
});

const jsonCreateSchema = z.object({
  label: z.string().min(1),
  content: resumeDataSchema.optional(),
});

export const POST = api.route({}, async ({ req, profileId }) => {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const labelRaw = form.get("label");

    if (!(file instanceof File)) {
      throw badRequest("file field is required");
    }
    if (file.size > MAX_RESUME_BYTES) {
      throw badRequest("Resume must be 5 MB or less");
    }
    const label =
      typeof labelRaw === "string" && labelRaw.trim()
        ? labelRaw.trim()
        : path.basename(file.name, path.extname(file.name)) || "Resume";

    const dir = await ensureResumesDir();
    const filename = generateResumeFilename(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), buffer);

    const resume = await db.resume.create({
      data: {
        profileId,
        label,
        sourceFilename: filename,
        sourceMimeType: file.type || "application/pdf",
        sourceSizeBytes: file.size,
      },
    });

    const isFirst = (await db.resume.count({ where: { profileId } })) === 1;
    if (isFirst) {
      await db.profile.update({
        where: { id: profileId },
        data: { primaryResumeId: resume.id },
      });
    }

    return { id: resume.id };
  }

  const data = jsonCreateSchema.parse(await req.json());

  const resume = await db.resume.create({
    data: {
      profileId,
      label: data.label,
      content: data.content ? JSON.stringify(data.content) : null,
    },
  });

  return { id: resume.id };
});
