/** Ported from career-ops's build-cv-latex.mjs — LaTeX special-character escaping. */
export function escapeLatex(text: string | undefined | null): string {
  if (typeof text !== "string") return "";
  const out: string[] = [];
  for (const ch of text) {
    switch (ch) {
      case "\\":
        out.push("\\textbackslash{}");
        break;
      case "{":
      case "}":
        out.push("\\" + ch);
        break;
      case "^":
        out.push("\\textasciicircum{}");
        break;
      case "~":
        out.push("\\textasciitilde{}");
        break;
      case "_":
        out.push("\\_");
        break;
      case "&":
        out.push("\\&");
        break;
      case "%":
        out.push("\\%");
        break;
      case "$":
        out.push("\\$");
        break;
      case "#":
        out.push("\\#");
        break;
      case "±":
        out.push("$\\pm$");
        break;
      case "→":
        out.push("$\\rightarrow$");
        break;
      default:
        out.push(ch);
    }
  }
  return out.join("");
}

/** Strips characters that would break a \href{...} target; adds a scheme if missing. */
export function sanitizeLatexUrl(url: string | undefined | null): string {
  if (typeof url !== "string") return "";
  let trimmed = url.trim();
  if (!trimmed) return "";
  const allowedSchemes = ["mailto:", "http:", "https:"];
  const hasScheme = allowedSchemes.some((s) => trimmed.toLowerCase().startsWith(s));
  if (!hasScheme) {
    trimmed = trimmed.includes("@") && !trimmed.includes("/") ? `mailto:${trimmed}` : `https://${trimmed}`;
  }
  return trimmed.replace(/[{}%$#\\~^]/g, "");
}
