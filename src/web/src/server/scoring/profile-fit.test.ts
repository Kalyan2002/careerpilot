import { describe, expect, test } from "bun:test";
import type { ResumeData } from "@/api/contracts/resume";
import { deriveProfileFitInputs, yearsSinceEarliestExperience } from "./profile-fit";

const baseResume: ResumeData = {
  basics: { name: "Test Candidate" },
  experience: [],
  projects: [],
  skills: [],
  education: [],
};

describe("yearsSinceEarliestExperience", () => {
  test("null when there are no experience entries", () => {
    expect(yearsSinceEarliestExperience(baseResume)).toBeNull();
  });

  test("null when no experience has a valid start date", () => {
    const resume: ResumeData = {
      ...baseResume,
      experience: [
        { company: "Acme", title: "Engineer", start: "", bullets: [] },
        { company: "Globex", title: "Engineer", start: "not-a-date", bullets: [] },
      ],
    };
    expect(yearsSinceEarliestExperience(resume)).toBeNull();
  });

  test("measures from the earliest valid start date", () => {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const resume: ResumeData = {
      ...baseResume,
      experience: [
        { company: "Recent", title: "Engineer", start: twoYearsAgo.toISOString(), bullets: [] },
        { company: "Oldest", title: "Engineer", start: fiveYearsAgo.toISOString(), bullets: [] },
      ],
    };

    expect(yearsSinceEarliestExperience(resume)).toBe(5);
  });
});

describe("deriveProfileFitInputs", () => {
  test("empty resume yields empty tech stack and null years", () => {
    expect(deriveProfileFitInputs(baseResume)).toEqual({
      techStack: [],
      yearsExperience: null,
    });
  });

  test("flattens skill groups and derives years from earliest experience", () => {
    const fourYearsAgo = new Date();
    fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);

    const resume: ResumeData = {
      ...baseResume,
      skills: [
        { group: "Languages", items: ["TypeScript", "Go"] },
        { group: "Cloud", items: ["AWS"] },
      ],
      experience: [
        { company: "Acme", title: "Engineer", start: fourYearsAgo.toISOString(), bullets: [] },
      ],
    };

    expect(deriveProfileFitInputs(resume)).toEqual({
      techStack: ["TypeScript", "Go", "AWS"],
      yearsExperience: 4,
    });
  });
});
