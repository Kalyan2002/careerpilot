import { z } from "zod/v4";
import type { ResumeData } from "@/api/contracts/resume";
import { idParam } from "@/api/contracts/shared";
import { badRequest } from "@/server/api/errors";
import { findOwned } from "@/server/api/owned";
import { api } from "@/server/api/route";
import { db } from "@/server/db";
import { compileLatexToPdf, LatexEngineNotFoundError } from "@/server/pdf/latex-compile";
import { buildResumeLatex } from "@/server/pdf/latex-template";
import { slugifyForDownload } from "@/server/storage";

const querySchema = z.object({ compile: z.string().optional() });

/**
 * LaTeX/Overleaf export of a resume, built from the same `ResumeData` model as
 * the existing HTML/react-pdf renderer (`server/pdf/render.ts`) — one shared
 * CV data model, two export formats. Default: returns the `.tex` source
 * (paste into Overleaf, no local toolchain needed). `?compile=1` additionally
 * compiles it to PDF locally via tectonic/pdflatex, if installed.
 */
export const GET = api.route({ params: idParam, query: querySchema }, async ({ params, query, profileId }) => {
  const resume = await findOwned(
    (where) => db.resume.findFirst({ where }),
    { id: params.id, profileId },
    "Resume",
  );

  if (!resume.content) {
    throw badRequest("Resume has no structured content to export as LaTeX");
  }

  const tex = buildResumeLatex(JSON.parse(resume.content) as ResumeData);
  const slug = slugifyForDownload(resume.label);

  if (query.compile !== "1") {
    return new Response(tex, {
      headers: {
        "content-type": "application/x-tex; charset=utf-8",
        "content-disposition": `inline; filename="${slug}.tex"`,
      },
    });
  }

  try {
    const pdf = await compileLatexToPdf(tex);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${slug}.pdf"`,
      },
    });
  } catch (e) {
    if (e instanceof LatexEngineNotFoundError) {
      throw badRequest(e.message);
    }
    throw e;
  }
});
