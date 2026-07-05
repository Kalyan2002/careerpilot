import { z } from "zod/v4";
import { expandSynonyms, normalizeKeyword } from "./keyword-normalize";

export const jobDigestSchema = z.object({
  title: z.string().optional().default(""),
  company: z.string().optional().default(""),
  techStack: z.array(z.string()).optional().default([]),
  requirements: z.array(z.string()).optional().default([]),
  responsibilities: z.array(z.string()).optional().default([]),
  yearsExperience: z.number().int().min(0).max(50).nullable().optional(),
  descriptionExcerpt: z.string().optional().default(""),
});

export type JobDigest = z.infer<typeof jobDigestSchema>;

export const fitProfileSchema = z.object({
  techStack: z.array(z.string()).default([]),
  yearsExperience: z.number().int().min(0).max(50).nullable().default(null),
});

export type FitProfile = z.infer<typeof fitProfileSchema>;

export interface FitResult {
  score: number;
  confidence: number;
  strongMatches: string[];
  partialMatches: string[];
  gaps: string[];
}

const normalizedHas = (set: Set<string>, term: string): boolean =>
  expandSynonyms(term).some((variant) => set.has(variant));

/**
 * Heuristic keyword-overlap fit score. Server-side, deterministic, no LLM.
 * The model uses this to skip full deliberation on confident high/low scores
 * and only reason about borderline cases.
 *
 * Weights:
 *   40% tech overlap (harmonic mean of recall + precision, with synonyms)
 *   20% years-experience proximity
 *   20% keyword density in requirements
 *   20% baseline (rewards partial signal over zero signal)
 */
export function scoreFit(digest: JobDigest, profile: FitProfile): FitResult {
  const digestTech = (digest.techStack || []).filter(Boolean);
  const profileTech = (profile.techStack || []).filter(Boolean);
  const profileTechNormed = new Set<string>(profileTech.flatMap(expandSynonyms));

  const strongMatches: string[] = [];
  const gaps: string[] = [];

  for (const term of digestTech) {
    if (normalizedHas(profileTechNormed, term)) {
      strongMatches.push(term);
    } else {
      gaps.push(term);
    }
  }

  const recall = digestTech.length === 0 ? 0 : strongMatches.length / digestTech.length;
  // Recall-dominant: how much of the job's stack the candidate covers.
  // A small precision bonus (capped at 0.3) rewards focus without penalizing breadth.
  const precisionRaw = profileTech.length === 0 ? 0 : strongMatches.length / profileTech.length;
  const techOverlapScore = recall * 0.85 + Math.min(precisionRaw, 0.3) * 0.15;

  let yearsScore = 0.5;

  if (
    digest.yearsExperience !== null &&
    digest.yearsExperience !== undefined &&
    profile.yearsExperience !== null
  ) {
    const gap = profile.yearsExperience! - digest.yearsExperience;
    if (gap >= 0) {
      yearsScore = 1;
    } else {
      yearsScore = Math.max(0, 1 + gap / 3);
    }
  }

  const reqText = (digest.requirements || []).join(" ").toLowerCase();
  const reqMentionedTerms: string[] = [];
  const partialMatches: string[] = [];

  for (const term of digestTech) {
    if (reqText.includes(normalizeKeyword(term))) {
      reqMentionedTerms.push(term);
      if (!strongMatches.includes(term) && !partialMatches.includes(term)) {
        partialMatches.push(term);
      }
    }
  }

  // How well the candidate covers the tech the requirements text actually calls out
  // by name — not the full tech stack. A "nice to have" that's listed in techStack
  // but never restated in the requirements bullets shouldn't drag this down; falls
  // back to the overall tech-overlap score when nothing is echoed in requirements
  // (e.g. no requirements text provided at all).
  const reqDensityScore =
    reqMentionedTerms.length === 0
      ? techOverlapScore
      : reqMentionedTerms.filter((t) => strongMatches.includes(t)).length / reqMentionedTerms.length;
  const baselineScore = digestTech.length > 0 && strongMatches.length > 0 ? 1 : 0;
  const raw =
    techOverlapScore * 0.4 + yearsScore * 0.2 + reqDensityScore * 0.2 + baselineScore * 0.2;
  const score = Math.round(raw * 100);

  let confidence = 0;
  if (digestTech.length > 0) {
    confidence += 0.5;
  }
  if ((digest.requirements || []).length > 0) {
    confidence += 0.3;
  }
  if (digest.yearsExperience !== null && digest.yearsExperience !== undefined) {
    confidence += 0.2;
  }

  return {
    score,
    confidence: Math.round(confidence * 100) / 100,
    strongMatches,
    partialMatches: partialMatches.filter((t) => !strongMatches.includes(t)),
    gaps,
  };
}
