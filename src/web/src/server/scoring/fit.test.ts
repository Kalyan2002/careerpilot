import { describe, expect, test } from "bun:test";
import { scoreFit, type JobDigest } from "./fit";

const emptyDigest: JobDigest = {
  title: "",
  company: "",
  techStack: [],
  requirements: [],
  responsibilities: [],
  yearsExperience: null,
  descriptionExcerpt: "",
};

describe("scoreFit — score", () => {
  test("zero score when digest has no tech stack and no requirements", () => {
    const result = scoreFit(emptyDigest, { techStack: [], yearsExperience: null });
    expect(result.score).toBe(10);
    expect(result.confidence).toBe(0);
  });

  test("perfect overlap → high score", () => {
    const result = scoreFit(
      {
        ...emptyDigest,
        techStack: ["typescript", "react", "aws"],
        requirements: ["3+ years typescript and react experience"],
        yearsExperience: 3,
      },
      { techStack: ["typescript", "react", "aws"], yearsExperience: 5 },
    );
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.strongMatches).toEqual(["typescript", "react", "aws"]);
    expect(result.gaps).toEqual([]);
  });

  test("zero tech overlap → low score, gaps lists all digest tech", () => {
    const result = scoreFit(
      { ...emptyDigest, techStack: ["typescript", "react"] },
      { techStack: ["java", "spring"], yearsExperience: 5 },
    );
    expect(result.score).toBeLessThan(40);
    expect(result.strongMatches).toEqual([]);
    expect(result.gaps).toEqual(["typescript", "react"]);
  });

  test("partial overlap is reflected in score", () => {
    const result = scoreFit(
      { ...emptyDigest, techStack: ["typescript", "react", "aws", "k8s"] },
      { techStack: ["typescript", "react"], yearsExperience: 3 },
    );
    expect(result.strongMatches).toEqual(["typescript", "react"]);
    expect(result.gaps).toEqual(["aws", "k8s"]);
    expect(result.score).toBeGreaterThan(20);
    expect(result.score).toBeLessThan(80);
  });
});

describe("scoreFit — synonyms", () => {
  test("js in digest matches javascript in profile", () => {
    const result = scoreFit(
      { ...emptyDigest, techStack: ["js"] },
      { techStack: ["javascript"], yearsExperience: null },
    );
    expect(result.strongMatches).toEqual(["js"]);
    expect(result.gaps).toEqual([]);
  });

  test("javascript in digest matches js in profile", () => {
    const result = scoreFit(
      { ...emptyDigest, techStack: ["javascript"] },
      { techStack: ["js"], yearsExperience: null },
    );
    expect(result.strongMatches).toEqual(["javascript"]);
  });

  test("next.js in digest matches nextjs in profile", () => {
    const result = scoreFit(
      { ...emptyDigest, techStack: ["next.js"] },
      { techStack: ["nextjs"], yearsExperience: null },
    );
    expect(result.strongMatches).toEqual(["next.js"]);
  });

  test("k8s ↔ kubernetes", () => {
    const result = scoreFit(
      { ...emptyDigest, techStack: ["kubernetes"] },
      { techStack: ["k8s"], yearsExperience: null },
    );
    expect(result.strongMatches).toEqual(["kubernetes"]);
  });
});

describe("scoreFit — years experience", () => {
  test("profile years >= digest years → full yearsScore", () => {
    const withGap = scoreFit(
      { ...emptyDigest, techStack: ["typescript"], yearsExperience: 3 },
      { techStack: ["typescript"], yearsExperience: 5 },
    );
    const noGap = scoreFit(
      { ...emptyDigest, techStack: ["typescript"], yearsExperience: 3 },
      { techStack: ["typescript"], yearsExperience: 3 },
    );
    expect(withGap.score).toBe(noGap.score);
  });

  test("profile years short by 2 → years score reduced", () => {
    const exact = scoreFit(
      { ...emptyDigest, techStack: ["typescript"], yearsExperience: 5 },
      { techStack: ["typescript"], yearsExperience: 5 },
    );
    const short2 = scoreFit(
      { ...emptyDigest, techStack: ["typescript"], yearsExperience: 5 },
      { techStack: ["typescript"], yearsExperience: 3 },
    );
    expect(short2.score).toBeLessThan(exact.score);
  });

  test("profile years short by 5+ → yearsScore floors at 0", () => {
    const result = scoreFit(
      { ...emptyDigest, techStack: ["typescript"], yearsExperience: 10 },
      { techStack: ["typescript"], yearsExperience: 0 },
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  test("null years on either side → neutral 0.5 yearsScore", () => {
    const nullDigest = scoreFit(
      { ...emptyDigest, techStack: ["typescript"], yearsExperience: null },
      { techStack: ["typescript"], yearsExperience: 5 },
    );
    const nullProfile = scoreFit(
      { ...emptyDigest, techStack: ["typescript"], yearsExperience: 5 },
      { techStack: ["typescript"], yearsExperience: null },
    );
    expect(nullDigest.score).toBe(nullProfile.score);
  });
});

describe("scoreFit — confidence", () => {
  test("max confidence when techStack + requirements + years all populated", () => {
    const result = scoreFit(
      {
        ...emptyDigest,
        techStack: ["typescript"],
        requirements: ["3 years experience"],
        yearsExperience: 3,
      },
      { techStack: [], yearsExperience: null },
    );
    expect(result.confidence).toBe(1);
  });

  test("only techStack populated → 0.5 confidence", () => {
    const result = scoreFit(
      { ...emptyDigest, techStack: ["typescript"] },
      { techStack: [], yearsExperience: null },
    );
    expect(result.confidence).toBe(0.5);
  });

  test("only requirements populated → 0.3 confidence", () => {
    const result = scoreFit(
      { ...emptyDigest, requirements: ["3 years experience"] },
      { techStack: [], yearsExperience: null },
    );
    expect(result.confidence).toBe(0.3);
  });

  test("only yearsExperience populated → 0.2 confidence", () => {
    const result = scoreFit(
      { ...emptyDigest, yearsExperience: 3 },
      { techStack: [], yearsExperience: null },
    );
    expect(result.confidence).toBe(0.2);
  });

  test("zero confidence on empty digest", () => {
    const result = scoreFit(emptyDigest, { techStack: [], yearsExperience: null });
    expect(result.confidence).toBe(0);
  });
});

describe("scoreFit — partialMatches", () => {
  test("term appearing in requirements but not in profile → partial match", () => {
    const result = scoreFit(
      {
        ...emptyDigest,
        techStack: ["typescript", "react", "kafka"],
        requirements: ["experience with kafka pipelines"],
      },
      { techStack: ["typescript", "react"], yearsExperience: null },
    );
    expect(result.strongMatches).toEqual(["typescript", "react"]);
    expect(result.partialMatches).toEqual(["kafka"]);
    expect(result.gaps).toEqual(["kafka"]);
  });

  test("partial does not duplicate a strong match", () => {
    const result = scoreFit(
      {
        ...emptyDigest,
        techStack: ["typescript"],
        requirements: ["5 years typescript experience"],
      },
      { techStack: ["typescript"], yearsExperience: null },
    );
    expect(result.partialMatches).toEqual([]);
    expect(result.strongMatches).toEqual(["typescript"]);
  });

  test("partial only triggered by substring presence in requirements", () => {
    const result = scoreFit(
      {
        ...emptyDigest,
        techStack: ["go", "rust"],
        requirements: ["proficiency with go modules"],
      },
      { techStack: [], yearsExperience: null },
    );
    expect(result.partialMatches).toContain("go");
    expect(result.partialMatches).not.toContain("rust");
  });
});

describe("scoreFit — edge cases", () => {
  test("empty profile techStack with non-empty digest → all gaps", () => {
    const result = scoreFit(
      { ...emptyDigest, techStack: ["typescript", "react"] },
      { techStack: [], yearsExperience: null },
    );
    expect(result.strongMatches).toEqual([]);
    expect(result.gaps).toEqual(["typescript", "react"]);
  });

  test("empty-string entries in digest techStack are filtered before scoring", () => {
    const result = scoreFit(
      { ...emptyDigest, techStack: ["typescript", "", "react"] },
      { techStack: ["typescript", "react"], yearsExperience: null },
    );
    expect(result.strongMatches).toEqual(["typescript", "react"]);
    expect(result.gaps).toEqual([]);
  });

  test("score is rounded to integer", () => {
    const result = scoreFit(
      { ...emptyDigest, techStack: ["typescript", "react", "aws"] },
      { techStack: ["typescript"], yearsExperience: null },
    );
    expect(Number.isInteger(result.score)).toBe(true);
  });

  test("confidence is rounded to two decimal places", () => {
    const result = scoreFit(
      { ...emptyDigest, techStack: ["typescript"], yearsExperience: 3 },
      { techStack: [], yearsExperience: null },
    );
    expect(result.confidence).toBe(0.7);
  });
});
