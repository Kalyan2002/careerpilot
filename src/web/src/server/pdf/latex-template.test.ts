import { describe, expect, test } from "bun:test";
import type { ResumeData } from "@/api/contracts/resume";
import { EMPTY_RESUME_DATA } from "@/api/contracts/resume";
import { buildResumeLatex } from "./latex-template";

const sample: ResumeData = {
  basics: {
    name: "Jane Doe",
    location: "Berlin, Germany",
    phone: "+49 123 456",
    email: "jane@example.com",
    linkedin: "linkedin.com/in/janedoe",
    github: "github.com/janedoe",
  },
  summary: "Backend engineer",
  experience: [
    {
      company: "Acme Corp",
      title: "Senior Engineer",
      location: "Remote",
      start: "2022",
      end: "",
      bullets: ["Shipped 100% test coverage & $2M revenue impact"],
    },
  ],
  projects: [
    {
      name: "Side Project",
      bullets: ["Built a thing"],
      keywords: ["TypeScript", "Bun"],
    },
  ],
  skills: [{ group: "Languages", items: ["TypeScript", "Go"] }],
  education: [
    { school: "Test University", degree: "BSc Computer Science", start: "2016", end: "2020", details: [] },
  ],
};

describe("buildResumeLatex", () => {
  test("produces a well-formed document", () => {
    const tex = buildResumeLatex(sample);
    expect(tex).toContain("\\begin{document}");
    expect(tex).toContain("\\end{document}");
    expect(tex).toContain("\\documentclass[letterpaper,11pt]{article}");
  });

  test("includes escaped name and bullet text", () => {
    const tex = buildResumeLatex(sample);
    expect(tex).toContain("Jane Doe");
    expect(tex).toContain("Shipped 100\\% test coverage \\& \\$2M revenue impact");
  });

  test("includes all populated sections", () => {
    const tex = buildResumeLatex(sample);
    expect(tex).toContain("\\section{Education}");
    expect(tex).toContain("\\section{Work Experience}");
    expect(tex).toContain("\\section{Personal Projects}");
    expect(tex).toContain("\\section{Technical Skills}");
  });

  test("omits sections with no data", () => {
    const tex = buildResumeLatex({ ...EMPTY_RESUME_DATA, basics: { name: "Empty Resume" } });
    expect(tex).not.toContain("\\section{Education}");
    expect(tex).not.toContain("\\section{Work Experience}");
    expect(tex).not.toContain("\\section{Personal Projects}");
    expect(tex).not.toContain("\\section{Technical Skills}");
    expect(tex).toContain("\\begin{document}");
    expect(tex).toContain("\\end{document}");
  });

  test("sanitizes contact links", () => {
    const tex = buildResumeLatex(sample);
    expect(tex).toContain("\\href{https://linkedin.com/in/janedoe}");
    expect(tex).toContain("\\href{https://github.com/janedoe}");
    expect(tex).toContain("\\href{mailto:jane@example.com}");
  });

  test("uses project description as a bullet fallback when no bullets given", () => {
    const withDescriptionOnly: ResumeData = {
      ...EMPTY_RESUME_DATA,
      basics: { name: "X" },
      projects: [{ name: "Proj", description: "Did a thing", bullets: [], keywords: [] }],
    };
    const tex = buildResumeLatex(withDescriptionOnly);
    expect(tex).toContain("Did a thing");
  });
});
