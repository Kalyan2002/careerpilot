import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import type { ResumeData } from "@/api/contracts/resume";
import { idParam } from "@/api/contracts/shared";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";
import { renderResumePdf } from "@/server/pdf/render";
import { ensureGeneratedDir, generatedVariantPath, slugifyForDownload } from "@/server/storage";

export const GET = api.route({ params: idParam }, async ({ params, profileId }) => {
  const variant = await findOwned(
    (where) => db.resumeVariant.findFirst({ where }),
    { id: params.id, resume: { profileId } },
    "Variant",
  );

  await ensureGeneratedDir();
  const cachePath = generatedVariantPath(variant.id, variant.updatedAt.getTime());
  try {
    await stat(cachePath);
  } catch {
    const buffer = await renderResumePdf(JSON.parse(variant.content) as ResumeData);
    await writeFile(cachePath, buffer);
  }

  const stats = await stat(cachePath);
  const stream = createReadStream(cachePath);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(stats.size),
      "content-disposition": `inline; filename="${slugifyForDownload(variant.label)}.pdf"`,
    },
  });
});
