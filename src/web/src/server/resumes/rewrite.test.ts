import { describe, expect, test } from "bun:test";
import type { ResumeData } from "@/api/contracts/resume";
import { extractNumbers, validateRewrites } from "./rewrite";
import { tailorBase } from "./tailor";

const base: ResumeData = {
  basics: { name: "Test", email: "t@example.com" },
  summary: "Senior engineer.",
  experience: [
    {
      id: "exp_0",
      company: "Recent Co",
      title: "Senior Engineer",
      start: "2024-01",
      bullets: [
        "Built real-time messaging for 200+ users.",
        "Cut onboarding time 40%.",
        "Shipped React UI for billing.",
      ],
    },
    {
      id: "exp_1",
      company: "Middle Co",
      title: "Engineer",
      start: "2021-01",
      end: "2023-12",
      bullets: ["Maintained the Postgres data layer."],
    },
    {
      id: "exp_2",
      company: "Old Co",
      title: "Junior Engineer",
      start: "2018-01",
      end: "2020-12",
      bullets: ["Wrote internal tooling."],
    },
  ],
  projects: [],
  skills: [{ group: "Frontend", items: ["React", "Vue"] }],
  education: [],
};

describe("extractNumbers", () => {
  test("captures magnitude with unit and a bare-core form", () => {
    expect(extractNumbers("served 200+ users")).toEqual(new Set(["200+", "200"]));
    expect(extractNumbers("cut time 40%.")).toEqual(new Set(["40%", "40"]));
  });

  test("unit swap is not a new number (40% core 40 ⊆ original)", () => {
    const orig = extractNumbers("improved by 40%");
    expect([...extractNumbers("improved by 40 percent")].every((n) => orig.has(n))).toBe(true);
  });
});

describe("validateRewrites — hard guards", () => {
  test("valid rephrase passes and builds the apply map", () => {
    const v = validateRewrites(
      base,
      [
        {
          entryIndex: 0,
          bullets: [
            {
              original: "Built real-time messaging for 200+ users.",
              tailored: "Built real-time collaboration for 200+ users.",
            },
          ],
        },
      ],
      2,
    );
    expect(v.ok).toBe(true);
    expect(v.violations).toEqual([]);
    expect(v.map.get(0)?.get("Built real-time messaging for 200+ users.")).toBe(
      "Built real-time collaboration for 200+ users.",
    );
  });

  test("introducing a new number is rejected", () => {
    const v = validateRewrites(
      base,
      [
        {
          entryIndex: 0,
          bullets: [{ original: "Cut onboarding time 40%.", tailored: "Cut onboarding time 60%." }],
        },
      ],
      2,
    );
    expect(v.ok).toBe(false);
    expect(v.violations[0]).toContain("introduces number");
  });

  test("original not found in the base resume is rejected", () => {
    const v = validateRewrites(
      base,
      [
        {
          entryIndex: 0,
          bullets: [{ original: "A bullet that does not exist.", tailored: "Anything." }],
        },
      ],
      2,
    );
    expect(v.ok).toBe(false);
    expect(v.violations[0]).toContain("not found");
  });

  test("entry outside the reword window is rejected", () => {
    const v = validateRewrites(
      base,
      [
        {
          entryIndex: 2,
          bullets: [{ original: "Wrote internal tooling.", tailored: "Wrote internal tooling." }],
        },
      ],
      2,
    );
    expect(v.ok).toBe(false);
    expect(v.violations[0]).toContain("outside the rewordable window");
  });

  test("rewording the same bullet twice is rejected", () => {
    const v = validateRewrites(
      base,
      [
        {
          entryIndex: 0,
          bullets: [
            { original: "Shipped React UI for billing.", tailored: "Shipped React billing UI." },
            { original: "Shipped React UI for billing.", tailored: "Built React billing UI." },
          ],
        },
      ],
      2,
    );
    expect(v.ok).toBe(false);
    expect(v.violations.some((m) => m.includes("more than once"))).toBe(true);
  });
});

describe("validateRewrites — soft drift flags", () => {
  test("a new tech term not in the resume is flagged, not rejected", () => {
    const v = validateRewrites(
      base,
      [
        {
          entryIndex: 0,
          bullets: [
            {
              original: "Shipped React UI for billing.",
              tailored: "Shipped React and GraphQL UI for billing.",
            },
          ],
        },
      ],
      2,
    );
    expect(v.ok).toBe(true);
    expect(v.audit[0].bullets[0].flags.some((f) => f.includes("GraphQL"))).toBe(true);
  });
});

describe("tailorBase — applying rewrites", () => {
  test("replaces the matched bullet for in-window entries", () => {
    const map = new Map([
      [
        0,
        new Map([["Shipped React UI for billing.", "Shipped React billing UI aligned to the JD."]]),
      ],
    ]);
    const out = tailorBase(base, { bulletRewrites: map, rewordTopN: 2 });
    expect(out.experience[0].bullets).toContain("Shipped React billing UI aligned to the JD.");
    expect(out.experience[0].bullets).not.toContain("Shipped React UI for billing.");
  });

  test("ignores rewrites for entries beyond rewordTopN", () => {
    const map = new Map([[1, new Map([["Maintained the Postgres data layer.", "REWORDED"]])]]);
    const out = tailorBase(base, { bulletRewrites: map, rewordTopN: 1 });
    expect(out.experience[1].bullets).toEqual(["Maintained the Postgres data layer."]);
  });
});
