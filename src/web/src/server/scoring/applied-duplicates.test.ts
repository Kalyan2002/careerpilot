import { describe, expect, test } from "bun:test";
import {
  APPLIED_DUPLICATE_THRESHOLD,
  APPLIED_DUPLICATE_WINDOW_DAYS,
  findFuzzyDuplicate,
  normalizeCompanyName,
  normalizeJobTitle,
  type FuzzyMatchCandidate,
} from "./applied-duplicates";

describe("normalizeJobTitle", () => {
  test("lowercases and strips punctuation", () => {
    expect(normalizeJobTitle("Frontend Engineer")).toBe("frontend engineer");
    expect(normalizeJobTitle("FRONTEND ENGINEER!")).toBe("frontend engineer");
  });

  test("strips seniority tokens (junior, jr, mid, senior, sr, staff, principal, lead)", () => {
    expect(normalizeJobTitle("Junior Frontend Engineer")).toBe("frontend engineer");
    expect(normalizeJobTitle("Jr Frontend Engineer")).toBe("frontend engineer");
    expect(normalizeJobTitle("Senior Frontend Engineer")).toBe("frontend engineer");
    expect(normalizeJobTitle("Sr. Frontend Engineer")).toBe("frontend engineer");
    expect(normalizeJobTitle("Staff Frontend Engineer")).toBe("frontend engineer");
    expect(normalizeJobTitle("Principal Frontend Engineer")).toBe("frontend engineer");
    expect(normalizeJobTitle("Lead Frontend Engineer")).toBe("frontend engineer");
  });

  test("strips Roman numeral seniority tokens", () => {
    expect(normalizeJobTitle("Software Engineer II")).toBe("software engineer");
    expect(normalizeJobTitle("Software Engineer III")).toBe("software engineer");
    expect(normalizeJobTitle("Software Engineer IV")).toBe("software engineer");
  });

  test("strips executive tokens", () => {
    expect(normalizeJobTitle("VP of Engineering")).toBe("of engineering");
    expect(normalizeJobTitle("Chief Technology Officer")).toBe("technology officer");
    expect(normalizeJobTitle("Director of Product")).toBe("of product");
  });

  test("collapses multiple separators", () => {
    expect(normalizeJobTitle("Senior  Frontend   Engineer")).toBe("frontend engineer");
    expect(normalizeJobTitle("Senior-Frontend/Engineer")).toBe("frontend engineer");
  });

  test("returns empty string for input that's all seniority tokens", () => {
    expect(normalizeJobTitle("Senior")).toBe("");
    expect(normalizeJobTitle("Junior Mid Senior")).toBe("");
  });

  test("returns empty string for empty input", () => {
    expect(normalizeJobTitle("")).toBe("");
    expect(normalizeJobTitle("   ")).toBe("");
  });

  test("equivalent titles at different seniority levels normalize identically", () => {
    expect(normalizeJobTitle("Junior Frontend Engineer")).toBe(
      normalizeJobTitle("Senior Frontend Engineer"),
    );
    expect(normalizeJobTitle("Sr. Software Engineer")).toBe(
      normalizeJobTitle("Staff Software Engineer"),
    );
  });
});

describe("normalizeCompanyName", () => {
  test("lowercases and strips punctuation", () => {
    expect(normalizeCompanyName("Acme")).toBe("acme");
    expect(normalizeCompanyName("ACME!")).toBe("acme");
  });

  test("strips corporate suffixes", () => {
    expect(normalizeCompanyName("Acme Inc")).toBe("acme");
    expect(normalizeCompanyName("Acme, Inc.")).toBe("acme");
    expect(normalizeCompanyName("Acme Incorporated")).toBe("acme");
    expect(normalizeCompanyName("Acme LLC")).toBe("acme");
    expect(normalizeCompanyName("Acme Ltd.")).toBe("acme");
    expect(normalizeCompanyName("Acme Limited")).toBe("acme");
    expect(normalizeCompanyName("Acme Corp")).toBe("acme");
    expect(normalizeCompanyName("Acme Corporation")).toBe("acme");
    expect(normalizeCompanyName("Acme Co.")).toBe("acme");
  });

  test("strips international corporate suffixes", () => {
    expect(normalizeCompanyName("Acme GmbH")).toBe("acme");
    expect(normalizeCompanyName("Acme AG")).toBe("acme");
    expect(normalizeCompanyName("Acme PLC")).toBe("acme");
    expect(normalizeCompanyName("Acme SA")).toBe("acme");
    expect(normalizeCompanyName("Acme BV")).toBe("acme");
  });

  test("same company with and without suffix normalizes identically", () => {
    expect(normalizeCompanyName("Stripe")).toBe(normalizeCompanyName("Stripe, Inc."));
    expect(normalizeCompanyName("OpenAI")).toBe(normalizeCompanyName("OpenAI Corp"));
  });

  test("multi-word company names preserve internal structure", () => {
    expect(normalizeCompanyName("Goldman Sachs")).toBe("goldman sachs");
    expect(normalizeCompanyName("Lyft, Inc.")).toBe("lyft");
  });

  test("empty input returns empty", () => {
    expect(normalizeCompanyName("")).toBe("");
    expect(normalizeCompanyName("Inc.")).toBe("");
  });
});

const makeCandidate = (id: number, title: string, company: string): FuzzyMatchCandidate => ({
  id,
  url: `https://example.com/jobs/${id}`,
  title,
  company,
  appliedAt: new Date(),
});

describe("findFuzzyDuplicate", () => {
  test("exact title+company match returns the candidate", () => {
    const result = findFuzzyDuplicate({ title: "Frontend Engineer", company: "Acme" }, [
      makeCandidate(1, "Frontend Engineer", "Acme"),
    ]);
    expect(result).not.toBeNull();
    expect(result!.candidate.id).toBe(1);
    expect(result!.score).toBe(100);
  });

  test("different seniority same role matches (seniority normalized away)", () => {
    const result = findFuzzyDuplicate({ title: "Senior Frontend Engineer", company: "Acme" }, [
      makeCandidate(1, "Junior Frontend Engineer", "Acme"),
    ]);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(100);
  });

  test("company with vs without suffix matches", () => {
    const result = findFuzzyDuplicate({ title: "Software Engineer", company: "Stripe" }, [
      makeCandidate(1, "Software Engineer", "Stripe, Inc."),
    ]);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(100);
  });

  test("totally different titles return null", () => {
    const result = findFuzzyDuplicate({ title: "Frontend Engineer", company: "Acme" }, [
      makeCandidate(1, "Data Scientist", "Acme"),
    ]);
    expect(result).toBeNull();
  });

  test("totally different companies return null", () => {
    const result = findFuzzyDuplicate({ title: "Frontend Engineer", company: "Acme" }, [
      makeCandidate(1, "Frontend Engineer", "Microsoft"),
    ]);
    expect(result).toBeNull();
  });

  test("empty title input returns null", () => {
    const result = findFuzzyDuplicate({ title: "", company: "Acme" }, [
      makeCandidate(1, "Frontend Engineer", "Acme"),
    ]);
    expect(result).toBeNull();
  });

  test("empty company input returns null", () => {
    const result = findFuzzyDuplicate({ title: "Frontend Engineer", company: "" }, [
      makeCandidate(1, "Frontend Engineer", "Acme"),
    ]);
    expect(result).toBeNull();
  });

  test("candidate with empty normalized title is skipped", () => {
    const result = findFuzzyDuplicate({ title: "Frontend Engineer", company: "Acme" }, [
      makeCandidate(1, "Senior", "Acme"),
      makeCandidate(2, "Frontend Engineer", "Acme"),
    ]);
    expect(result).not.toBeNull();
    expect(result!.candidate.id).toBe(2);
  });

  test("returns highest-scoring candidate among multiple matches", () => {
    const result = findFuzzyDuplicate({ title: "Senior Frontend Engineer", company: "Stripe" }, [
      makeCandidate(1, "Frontend Developer", "Stripe"),
      makeCandidate(2, "Senior Frontend Engineer", "Stripe"),
      makeCandidate(3, "Backend Engineer", "Stripe"),
    ]);
    expect(result).not.toBeNull();
    expect(result!.candidate.id).toBe(2);
    expect(result!.score).toBe(100);
  });

  test("respects custom threshold (lower threshold catches looser matches)", () => {
    const candidate = makeCandidate(1, "Data Engineer", "Stripe");
    const strictResult = findFuzzyDuplicate({ title: "Software Engineer", company: "Stripe" }, [
      candidate,
    ]);
    expect(strictResult).toBeNull();

    const looseResult = findFuzzyDuplicate(
      { title: "Software Engineer", company: "Stripe" },
      [candidate],
      60,
    );
    expect(looseResult).not.toBeNull();
  });

  test("empty candidate list returns null", () => {
    const result = findFuzzyDuplicate({ title: "Frontend Engineer", company: "Acme" }, []);
    expect(result).toBeNull();
  });

  test("title and company score weighted 60/40", () => {
    const result = findFuzzyDuplicate({ title: "Frontend Engineer", company: "Acme" }, [
      makeCandidate(1, "Frontend Engineer", "Acmey"),
    ]);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(APPLIED_DUPLICATE_THRESHOLD);
  });
});

describe("constants", () => {
  test("threshold and window have expected values", () => {
    expect(APPLIED_DUPLICATE_THRESHOLD).toBe(90);
    expect(APPLIED_DUPLICATE_WINDOW_DAYS).toBe(30);
  });
});
