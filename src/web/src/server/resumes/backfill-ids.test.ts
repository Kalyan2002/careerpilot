import { describe, expect, test } from "bun:test";
import type { ResumeData } from "@/api/contracts/resume";
import { backfillResumeIds } from "./backfill-ids";

const baseResume: ResumeData = {
  basics: { name: "Test User", email: "t@example.com" },
  summary: "",
  experience: [],
  projects: [],
  skills: [],
  education: [],
};

describe("backfillResumeIds — no-op cases", () => {
  test("empty experience and projects → not mutated", () => {
    const result = backfillResumeIds(baseResume);
    expect(result.mutated).toBe(false);
    expect(result.content).toBe(baseResume);
  });

  test("all experience entries have ids → not mutated", () => {
    const input: ResumeData = {
      ...baseResume,
      experience: [
        { id: "exp_a", company: "Acme", title: "Engineer", start: "2022", bullets: [] },
        { id: "exp_b", company: "Beta", title: "Engineer", start: "2024", bullets: [] },
      ],
    };
    const result = backfillResumeIds(input);
    expect(result.mutated).toBe(false);
    expect(result.content).toBe(input);
  });

  test("all project entries have ids → not mutated", () => {
    const input: ResumeData = {
      ...baseResume,
      projects: [{ id: "proj_a", name: "Side", bullets: [], keywords: [] }],
    };
    const result = backfillResumeIds(input);
    expect(result.mutated).toBe(false);
    expect(result.content).toBe(input);
  });

  test("idempotent: backfilled output → second pass is a no-op", () => {
    const input: ResumeData = {
      ...baseResume,
      experience: [{ company: "Acme", title: "Engineer", start: "2022", bullets: [] }],
      projects: [{ name: "Side", bullets: [], keywords: [] }],
    };
    const first = backfillResumeIds(input);
    expect(first.mutated).toBe(true);
    const second = backfillResumeIds(first.content);
    expect(second.mutated).toBe(false);
    expect(second.content).toBe(first.content);
  });
});

describe("backfillResumeIds — generation", () => {
  test("missing experience id is assigned", () => {
    const input: ResumeData = {
      ...baseResume,
      experience: [{ company: "Acme", title: "Engineer", start: "2022", bullets: [] }],
    };
    const result = backfillResumeIds(input);
    expect(result.mutated).toBe(true);
    expect(result.content.experience[0].id).toBeDefined();
    expect(result.content.experience[0].id).toMatch(/^exp_[a-f0-9]{10}$/);
  });

  test("missing project id is assigned", () => {
    const input: ResumeData = {
      ...baseResume,
      projects: [{ name: "Side", bullets: [], keywords: [] }],
    };
    const result = backfillResumeIds(input);
    expect(result.mutated).toBe(true);
    expect(result.content.projects[0].id).toBeDefined();
    expect(result.content.projects[0].id).toMatch(/^proj_[a-f0-9]{10}$/);
  });

  test("preserves existing id when one already present", () => {
    const input: ResumeData = {
      ...baseResume,
      experience: [
        { id: "exp_custom", company: "Acme", title: "Engineer", start: "2022", bullets: [] },
        { company: "Beta", title: "Engineer", start: "2024", bullets: [] },
      ],
    };
    const result = backfillResumeIds(input);
    expect(result.mutated).toBe(true);
    expect(result.content.experience[0].id).toBe("exp_custom");
    expect(result.content.experience[1].id).toMatch(/^exp_[a-f0-9]{10}$/);
  });

  test("backfill preserves all non-id fields verbatim", () => {
    const input: ResumeData = {
      ...baseResume,
      experience: [
        {
          company: "Acme",
          title: "Engineer",
          location: "NYC",
          start: "2022",
          end: "2024",
          bullets: ["a", "b", "c"],
        },
      ],
    };
    const result = backfillResumeIds(input);
    const entry = result.content.experience[0];
    expect(entry.company).toBe("Acme");
    expect(entry.title).toBe("Engineer");
    expect(entry.location).toBe("NYC");
    expect(entry.start).toBe("2022");
    expect(entry.end).toBe("2024");
    expect(entry.bullets).toEqual(["a", "b", "c"]);
  });
});

describe("backfillResumeIds — determinism", () => {
  test("same input yields same ids across calls", () => {
    const input: ResumeData = {
      ...baseResume,
      experience: [
        { company: "Acme", title: "Engineer", start: "2022", bullets: [] },
        { company: "Beta", title: "Engineer", start: "2024", bullets: [] },
      ],
    };
    const a = backfillResumeIds(input);
    const b = backfillResumeIds({
      ...baseResume,
      experience: input.experience.map((e) => ({ ...e })),
    });
    expect(a.content.experience.map((e) => e.id)).toEqual(b.content.experience.map((e) => e.id));
  });

  test("case and whitespace in identifying fields don't change the id", () => {
    const a = backfillResumeIds({
      ...baseResume,
      experience: [{ company: "Acme", title: "Engineer", start: "2022", bullets: [] }],
    });
    const b = backfillResumeIds({
      ...baseResume,
      experience: [{ company: "  ACME  ", title: "engineer", start: "2022", bullets: [] }],
    });
    expect(a.content.experience[0].id).toBe(b.content.experience[0].id);
  });

  test("different identifying fields yield different ids", () => {
    const result = backfillResumeIds({
      ...baseResume,
      experience: [
        { company: "Acme", title: "Engineer", start: "2022", bullets: [] },
        { company: "Beta", title: "Engineer", start: "2022", bullets: [] },
      ],
    });
    expect(result.content.experience[0].id).not.toBe(result.content.experience[1].id);
  });
});

describe("backfillResumeIds — collisions", () => {
  test("two entries with identical key parts get unique ids via suffix", () => {
    const result = backfillResumeIds({
      ...baseResume,
      experience: [
        { company: "Acme", title: "Engineer", start: "2022", bullets: ["first"] },
        { company: "Acme", title: "Engineer", start: "2022", bullets: ["second"] },
      ],
    });
    const ids = result.content.experience.map((e) => e.id);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids[0]).toMatch(/^exp_[a-f0-9]{10}$/);
    expect(ids[1]).toMatch(/^exp_[a-f0-9]{10}$/);
  });

  test("existing id reserved before suffix probing", () => {
    const collidingId = backfillResumeIds({
      ...baseResume,
      experience: [{ company: "Acme", title: "Engineer", start: "2022", bullets: [] }],
    }).content.experience[0].id!;

    const result = backfillResumeIds({
      ...baseResume,
      experience: [
        { id: collidingId, company: "Different", title: "Role", start: "2020", bullets: [] },
        { company: "Acme", title: "Engineer", start: "2022", bullets: [] },
      ],
    });
    expect(result.content.experience[0].id).toBe(collidingId);
    expect(result.content.experience[1].id).not.toBe(collidingId);
  });
});

describe("backfillResumeIds — namespace separation", () => {
  test("experience and projects use different id prefixes", () => {
    const result = backfillResumeIds({
      ...baseResume,
      experience: [{ company: "Acme", title: "Engineer", start: "2022", bullets: [] }],
      projects: [{ name: "Side", bullets: [], keywords: [] }],
    });
    expect(result.content.experience[0].id).toMatch(/^exp_/);
    expect(result.content.projects[0].id).toMatch(/^proj_/);
  });

  test("experience and project with identical key parts get different ids", () => {
    const result = backfillResumeIds({
      ...baseResume,
      experience: [{ company: "Same", title: "Same", start: "2022", bullets: [] }],
      projects: [{ name: "Same", url: "2022", bullets: [], keywords: [] }],
    });
    expect(result.content.experience[0].id).not.toBe(result.content.projects[0].id);
  });
});

describe("backfillResumeIds — partial mutation", () => {
  test("mutated:true when experience needs ids but projects don't", () => {
    const result = backfillResumeIds({
      ...baseResume,
      experience: [{ company: "Acme", title: "Engineer", start: "2022", bullets: [] }],
      projects: [{ id: "proj_existing", name: "Side", bullets: [], keywords: [] }],
    });
    expect(result.mutated).toBe(true);
    expect(result.content.experience[0].id).toBeDefined();
    expect(result.content.projects[0].id).toBe("proj_existing");
  });

  test("mutated:true when projects need ids but experience doesn't", () => {
    const result = backfillResumeIds({
      ...baseResume,
      experience: [
        { id: "exp_existing", company: "Acme", title: "Engineer", start: "2022", bullets: [] },
      ],
      projects: [{ name: "Side", bullets: [], keywords: [] }],
    });
    expect(result.mutated).toBe(true);
    expect(result.content.projects[0].id).toBeDefined();
    expect(result.content.experience[0].id).toBe("exp_existing");
  });
});
