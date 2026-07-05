/**
 * Ported from career-ops's liveness-core.mjs (pure classifier, no browser
 * dependency). Classifies whether a job posting page is still active from
 * its HTTP status, final URL, body text, and detected apply-button labels.
 */

const HARD_EXPIRED_PATTERNS = [
  /job (is )?no longer available/i,
  /job.*no longer open/i,
  /position has been filled/i,
  /this job has expired/i,
  /job posting has expired/i,
  /no longer accepting applications/i,
  /this (position|role|job) (is )?no longer/i,
  /this job (listing )?is closed/i,
  /job (listing )?not found/i,
  /the page you are looking for doesn.t exist/i,
  /applications?\s+(?:(?:have|are|is)\s+)?closed/i,
  /closed on \d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  /closed on (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/i,
  /diese stelle (ist )?(nicht mehr|bereits) besetzt/i,
  /offre (expirée|n'est plus disponible)/i,
];

const LISTING_PAGE_PATTERNS = [/\d+\s+jobs?\s+found/i, /search for jobs page is loaded/i];

// Anti-bot interstitials (Cloudflare "Just a moment...", hCaptcha walls, etc.)
// render a tiny challenge page instead of the posting. Headless browser checks
// trip these on some portals. They must NOT be read as expired: the body is
// short and lacks an apply control, so without this guard they'd fall through
// to insufficient_content -> expired, permanently mis-marking a live posting.
const BOT_CHALLENGE_PATTERNS = [
  /just a moment/i,
  /performing security verification/i,
  /checking your browser before/i,
  /verify you are (a |not a )?human/i,
  /enable javascript and cookies to continue/i,
  /attention required.*cloudflare/i,
  /\bray id\b/i,
  /\bcf-ray\b/i,
  /please complete the security check/i,
];

const EXPIRED_URL_PATTERNS = [/[?&]error=true/i];

const APPLY_PATTERNS = [
  /\bapply\b/i,
  /\bsolicitar\b/i,
  /\bbewerben\b/i,
  /\bpostuler\b/i,
  /submit application/i,
  /easy apply/i,
  /start application/i,
  /ich bewerbe mich/i,
  // Polish (pracuj.pl, justjoin.it, bulldogjob.pl)
  /\baplikuj\b/i,
  /panelu aplikowania/i,
  /wyślij (cv|aplikacj)/i,
];

const MIN_CONTENT_CHARS = 300;

function firstMatch(patterns: RegExp[], text = ""): RegExp | undefined {
  return patterns.find((pattern) => pattern.test(text));
}

function hasApplyControl(controls: string[] = []): boolean {
  return controls.some((control) => APPLY_PATTERNS.some((pattern) => pattern.test(control)));
}

export type LivenessResult = "active" | "expired" | "uncertain";

export interface LivenessClassification {
  result: LivenessResult;
  code: string;
  reason: string;
}

export interface LivenessInput {
  status?: number;
  finalUrl?: string;
  bodyText?: string;
  applyControls?: string[];
}

export function classifyLiveness({
  status = 0,
  finalUrl = "",
  bodyText = "",
  applyControls = [],
}: LivenessInput = {}): LivenessClassification {
  if (status === 404 || status === 410) {
    return { result: "expired", code: "http_gone", reason: `HTTP ${status}` };
  }

  // Bot/anti-scraping walls — never expired. Checked before content-length and
  // listing-page heuristics, which would otherwise misread the short challenge
  // body as a dead posting. 403/503 are access-blocked signals, not "gone".
  const botChallenge = firstMatch(BOT_CHALLENGE_PATTERNS, bodyText);
  if (botChallenge) {
    return {
      result: "uncertain",
      code: "bot_challenge",
      reason: `anti-bot challenge: ${botChallenge.source}`,
    };
  }
  if (status === 403 || status === 503) {
    return {
      result: "uncertain",
      code: "access_blocked",
      reason: `HTTP ${status} (access blocked, likely anti-bot)`,
    };
  }

  const expiredUrl = firstMatch(EXPIRED_URL_PATTERNS, finalUrl);
  if (expiredUrl) {
    return { result: "expired", code: "expired_url", reason: `redirect to ${finalUrl}` };
  }

  const expiredBody = firstMatch(HARD_EXPIRED_PATTERNS, bodyText);
  if (expiredBody) {
    return { result: "expired", code: "expired_body", reason: `pattern matched: ${expiredBody.source}` };
  }

  if (hasApplyControl(applyControls)) {
    return { result: "active", code: "apply_control_visible", reason: "visible apply control detected" };
  }

  const listingPage = firstMatch(LISTING_PAGE_PATTERNS, bodyText);
  if (listingPage) {
    return { result: "expired", code: "listing_page", reason: `pattern matched: ${listingPage.source}` };
  }

  if (bodyText.trim().length < MIN_CONTENT_CHARS) {
    return {
      result: "expired",
      code: "insufficient_content",
      reason: "insufficient content — likely nav/footer only",
    };
  }

  return {
    result: "uncertain",
    code: "no_apply_control",
    reason: "content present but no visible apply control found",
  };
}
