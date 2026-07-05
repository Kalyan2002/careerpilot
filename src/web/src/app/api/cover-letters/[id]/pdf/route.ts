import { idParam } from "@/api/contracts/shared";
import { api } from "@/server/api/route";
import { getCoverLetter } from "@/server/cover-letters/service";
import { renderCoverLetterPdf } from "@/server/pdf/render";
import { slugifyForDownload } from "@/server/storage";

/** Render a saved cover letter to a PDF, viewable inline in a new tab. */
export const GET = api.route({ params: idParam }, async ({ params, profileId }) => {
  const letter = await getCoverLetter(params.id, profileId);
  const buffer = await renderCoverLetterPdf(letter.content);
  const slug = slugifyForDownload(letter.company ?? letter.jobTitle ?? `cover-letter-${letter.id}`);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(buffer.length),
      "content-disposition": `inline; filename="${slug}.pdf"`,
    },
  });
});
