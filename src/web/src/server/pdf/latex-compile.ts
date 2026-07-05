/**
 * Ported from career-ops's generate-latex.mjs — compiles a .tex source string
 * to a PDF buffer via tectonic (preferred) or pdflatex, whichever is on PATH.
 * Optional: `/api/resumes/:id/pdf?format=tex` always works with no LaTeX
 * toolchain installed (it just returns the .tex source for Overleaf); this is
 * only used when a local PDF render of the LaTeX version is requested.
 */
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class LatexEngineNotFoundError extends Error {
  constructor() {
    super("No LaTeX engine found on PATH. Install tectonic or pdflatex (MiKTeX/TeX Live) to render LaTeX to PDF.");
  }
}

export class LatexCompileError extends Error {}

function detectEngine(): "tectonic" | "pdflatex" | null {
  for (const candidate of ["tectonic", "pdflatex"] as const) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "pipe" });
      return candidate;
    } catch {
      // not found, try next
    }
  }
  return null;
}

export async function compileLatexToPdf(texSource: string): Promise<Buffer> {
  const engine = detectEngine();
  if (!engine) throw new LatexEngineNotFoundError();

  const dir = await mkdtemp(join(tmpdir(), "careerpilot-latex-"));
  const texPath = join(dir, "resume.tex");

  try {
    if (engine === "tectonic") {
      // Tectonic doesn't support these pdflatex-only primitives.
      const patched = texSource
        .replace(/\\pdfgentounicode\s*=\s*\d+[^\n]*\n?/g, "")
        .replace(/\\input\{glyphtounicode\}[^\n]*\n?/g, "");
      await writeFile(texPath, patched, "utf-8");
      execFileSync("tectonic", ["--outdir", dir, texPath], { cwd: dir, stdio: "pipe", timeout: 120_000 });
    } else {
      await writeFile(texPath, texSource, "utf-8");
      const args = [
        "-no-shell-escape",
        "-interaction=nonstopmode",
        "-halt-on-error",
        `-output-directory=${dir}`,
        texPath,
      ];
      // Two passes to resolve any cross-references.
      execFileSync("pdflatex", args, { cwd: dir, stdio: "pipe", timeout: 120_000 });
      execFileSync("pdflatex", args, { cwd: dir, stdio: "pipe", timeout: 120_000 });
    }

    return await readFile(join(dir, "resume.pdf"));
  } catch (e) {
    const logPath = join(dir, "resume.log");
    let message = e instanceof Error ? e.message : String(e);
    try {
      const log = await readFile(logPath, "utf-8");
      const errorLines = log.split("\n").filter((l) => l.startsWith("!"));
      if (errorLines.length > 0) message = errorLines.join("\n");
    } catch {
      // no log file to read
    }
    throw new LatexCompileError(message);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
