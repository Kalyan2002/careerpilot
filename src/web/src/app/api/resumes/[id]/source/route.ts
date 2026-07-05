import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { idParam } from "@/api/contracts/shared";
import { MAX_RESUME_BYTES } from "@/lib/constants";
import { badRequest, notFound } from "@/server/api/errors";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";
import {
  deleteResumeFile,
  ensureResumesDir,
  generateResumeFilename,
  resumePath,
} from "@/server/storage";

const findResume = (id: number, profileId: number) =>
  findOwned((where) => db.resume.findFirst({ where }), { id, profileId }, "Resume");

export const GET = api.route({ params: idParam }, async ({ params, profileId }) => {
  const resume = await findResume(params.id, profileId);
  if (!resume.sourceFilename) {
    throw notFound("No source PDF uploaded");
  }

  const filePath = resumePath(resume.sourceFilename);
  try {
    const stats = await stat(filePath);
    const stream = createReadStream(filePath);
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "content-type": resume.sourceMimeType ?? "application/pdf",
        "content-length": String(stats.size),
        "content-disposition": `inline; filename="${resume.sourceFilename}"`,
      },
    });
  } catch {
    throw notFound("Source file missing on disk");
  }
});

export const POST = api.route({ params: idParam }, async ({ req, params, profileId }) => {
  const resume = await findResume(params.id, profileId);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw badRequest("file field is required");
  }
  if (file.size > MAX_RESUME_BYTES) {
    throw badRequest("Resume must be 5 MB or less");
  }

  const dir = await ensureResumesDir();
  const filename = generateResumeFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  if (resume.sourceFilename) {
    await deleteResumeFile(resume.sourceFilename);
  }

  await db.resume.update({
    where: { id: params.id },
    data: {
      sourceFilename: filename,
      sourceMimeType: file.type || "application/pdf",
      sourceSizeBytes: file.size,
    },
  });

  return { id: params.id, sourceFilename: filename };
});

export const DELETE = api.route({ params: idParam }, async ({ params, profileId }) => {
  const resume = await findResume(params.id, profileId);

  if (resume.sourceFilename) {
    await deleteResumeFile(resume.sourceFilename);
  }

  await db.resume.update({
    where: { id: params.id },
    data: { sourceFilename: null, sourceMimeType: null, sourceSizeBytes: null },
  });

  return { id: params.id };
});
