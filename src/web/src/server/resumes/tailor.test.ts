import { describe, expect, test } from "bun:test";
import type { ResumeData } from "@/api/contracts/resume";
import { tailorBase } from "./tailor";

const base: ResumeData = {
  basics: { name: "Test", email: "t@example.com" },
  summary: "Original summary.",
  experience: [
    {
      id: "exp_a",
      company: "Acme",
      title: "Engineer",
      start: "2022-01",
      bullets: [
        "Built dashboards in Vue.",
        "Shipped React UI for billing.",
        "Optimized Postgres queries.",
        "Wrote docs.",
        "Did standups.",
      ],
    },
  ],
  projects: [
    {
      id: "proj_a",
      name: "Side project",
      bullets: ["TypeScript and Next.js learning project.", "CSS tinkering."],
      keywords: [],
    },
  ],
  skills: [
    { group: "Languages", items: ["Python", "Go", "TypeScript"] },
    { group: "Frontend", items: ["Vue", "React", "Svelte"] },
  ],
  education: [],
};

describe("tailorBase", () => {
  test("identity when no opts passed", () => {
    const out = tailorBase(base, {});
    expect(out).toEqual(base);
  });

  test("splices summary when provided", () => {
    const out = tailorBase(base, { summary: "Tailored summary." });
    expect(out.summary).toBe("Tailored summary.");
  });

  test("ignores blank/whitespace summary", () => {
    const out = tailorBase(base, { summary: "   " });
    expect(out.summary).toBe(base.summary);
  });

  test("moves emphasized tech to front of its skill group", () => {
    const out = tailorBase(base, { emphasizedTech: ["typescript", "react"] });
    expect(out.skills[0].items[0].toLowerCase()).toBe("typescript");
    const frontendGroupAfter = out.skills.find((g) => g.group === "Frontend")!;
    expect(frontendGroupAfter.items[0].toLowerCase()).toBe("react");
  });

  test("reorders skill groups so emphasized-bearing groups come first", () => {
    const noEmphasisBase: ResumeData = {
      ...base,
      skills: [
        { group: "Backend", items: ["Java"] },
        { group: "Languages", items: ["Python", "TypeScript"] },
      ],
    };
    const out = tailorBase(noEmphasisBase, { emphasizedTech: ["typescript"] });
    expect(out.skills[0].group).toBe("Languages");
  });

  test("sorts experience bullets by keyword overlap and trims to maxBullets", () => {
    const out = tailorBase(base, {
      jobKeywords: ["react", "postgres"],
      maxBulletsPerEntry: 3,
    });
    const bullets = out.experience[0].bullets;
    expect(bullets.length).toBe(3);
    expect(bullets[0].toLowerCase()).toContain("react");
    expect(bullets[1].toLowerCase()).toContain("postgres");
  });

  test("emphasizedTech is used as keyword fallback when jobKeywords absent", () => {
    const out = tailorBase(base, { emphasizedTech: ["react"], maxBulletsPerEntry: 1 });
    expect(out.experience[0].bullets[0].toLowerCase()).toContain("react");
  });

  test("synonyms surface (next.js matches nextjs)", () => {
    const out = tailorBase(base, { jobKeywords: ["nextjs"], maxBulletsPerEntry: 1 });
    expect(out.projects[0].bullets[0].toLowerCase()).toContain("next.js");
  });

  test("preserves experience identity fields (id, company, title, start)", () => {
    const out = tailorBase(base, { jobKeywords: ["react"], maxBulletsPerEntry: 2 });
    expect(out.experience[0].id).toBe("exp_a");
    expect(out.experience[0].company).toBe("Acme");
    expect(out.experience[0].title).toBe("Engineer");
    expect(out.experience[0].start).toBe("2022-01");
  });
});
