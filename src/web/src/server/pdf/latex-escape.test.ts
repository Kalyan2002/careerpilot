import { describe, expect, test } from "bun:test";
import { escapeLatex, sanitizeLatexUrl } from "./latex-escape";

describe("escapeLatex", () => {
  test("escapes special LaTeX characters", () => {
    expect(escapeLatex("50% growth & $10k #1")).toBe("50\\% growth \\& \\$10k \\#1");
  });

  test("escapes braces and backslash", () => {
    expect(escapeLatex("C:\\path\\{x}")).toBe("C:\\textbackslash{}path\\textbackslash{}\\{x\\}");
  });

  test("escapes underscore, caret, tilde", () => {
    expect(escapeLatex("a_b^c~d")).toBe("a\\_b\\textasciicircum{}c\\textasciitilde{}d");
  });

  test("converts special unicode symbols", () => {
    expect(escapeLatex("±5% → growth")).toBe("$\\pm$5\\% $\\rightarrow$ growth");
  });

  test("passes through plain text unchanged", () => {
    expect(escapeLatex("Senior Software Engineer")).toBe("Senior Software Engineer");
  });

  test("non-string input returns empty string", () => {
    expect(escapeLatex(undefined)).toBe("");
    expect(escapeLatex(null)).toBe("");
  });
});

describe("sanitizeLatexUrl", () => {
  test("adds https scheme when missing", () => {
    expect(sanitizeLatexUrl("linkedin.com/in/test")).toBe("https://linkedin.com/in/test");
  });

  test("adds mailto scheme for bare emails", () => {
    expect(sanitizeLatexUrl("test@example.com")).toBe("mailto:test@example.com");
  });

  test("preserves an existing scheme", () => {
    expect(sanitizeLatexUrl("https://github.com/test")).toBe("https://github.com/test");
    expect(sanitizeLatexUrl("mailto:test@example.com")).toBe("mailto:test@example.com");
  });

  test("strips characters that would break a \\href target", () => {
    expect(sanitizeLatexUrl("https://example.com/{a}%b$c#d")).toBe("https://example.com/abcd");
  });

  test("empty/nullish input returns empty string", () => {
    expect(sanitizeLatexUrl("")).toBe("");
    expect(sanitizeLatexUrl(undefined)).toBe("");
    expect(sanitizeLatexUrl(null)).toBe("");
  });
});
