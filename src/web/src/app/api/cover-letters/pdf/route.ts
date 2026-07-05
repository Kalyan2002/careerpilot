import { z } from "zod/v4";
import { api } from "@/server/api/route";
import { renderCoverLetterPdf } from "@/server/pdf/render";

const requestSchema = z.object({
  text: z.string().min(1),
  name: z.string().optional(),
});

/**
 * Render the `cover-letter` skill's plain text to a PDF for upload-only
 * application forms. Ephemeral — the text differs per job, so nothing is stored.
 */
export const POST = api.route({ public: true, body: requestSchema }, async ({ body }) => {
  const buffer = await renderCoverLetterPdf(body.text);
  const slug = (body.name ?? "cover-letter").replace(/[^\w.-]+/g, "-");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(buffer.length),
      "content-disposition": `inline; filename="${slug}.pdf"`,
    },
  });
});
