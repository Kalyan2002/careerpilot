import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import type { ResumeData } from "@/api/contracts/resume";
import { idParam } from "@/api/contracts/shared";
import { notFound } from "@/server/api/errors";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";
import { renderResumePdf } from "@/server/pdf/render";
import {
  ensureGeneratedDir,
  generatedResumePath,
  resumePath,
  slugifyForDownload,
} from "@/server/storage";

async function streamFile(filePath: string, mime: string, downloadName: string): Promise<Response> {
  const stats = await stat(filePath);
  const stream = createReadStream(filePath);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "content-type": mime,
      "content-length": String(stats.size),
      "content-disposition": `inline; filename="${downloadName}"`,
    },
  });
}

export const GET = api.route({ params: idParam }, async ({ params, profileId }) => {
  const resume = await findOwned(
    (where) => db.resume.findFirst({ where }),
    { id: params.id, profileId },
    "Resume",
  );

  const slug = slugifyForDownload(resume.label);

  if (resume.content) {
    await ensureGeneratedDir();
    const cachePath = generatedResumePath(resume.id, resume.updatedAt.getTime());
    try {
      await stat(cachePath);
    } catch {
      const buffer = await renderResumePdf(JSON.parse(resume.content) as ResumeData);
      await writeFile(cachePath, buffer);
    }
    return streamFile(cachePath, "application/pdf", `${slug}.pdf`);
  }

  if (resume.sourceFilename) {
    try {
      return await streamFile(
        resumePath(resume.sourceFilename),
        resume.sourceMimeType ?? "application/pdf",
        resume.sourceFilename,
      );
    } catch {
      throw notFound("Source file missing on disk");
    }
  }

  throw notFound("Resume has no data or source PDF");
});
