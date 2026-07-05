---
name: search
description: Search a chosen job board via Playwright, rank results by fit against the user's resume, and save them to the campaign so the user can review.
argument-hint: "<job_title_keywords_location> --board <domain> [--max-jobs N] [--campaign <campaign-id>]"
---

# Job Search

Search a single board (picked by the user when launching the campaign) and rank results by qualification fit against the resume.

## Setup

1. Follow `../shared/setup.md`.
2. Parse and strip the flags; the rest is the free-text query.
   - `--board <domain>` — **required** (e.g. `--board linkedin.com`).
   - `--max-jobs <N>` — optional cap on results to rank (default 15, max 100).
   - `--campaign <campaign-id>` — campaign to save results to (Phase 5). The web UI passes it; if absent, match the latest `source:"search"`, `status:"in_progress"` campaign on the query, else create one.
3. Resolve the board:

   ```bash
   CAREERPILOT_API=http://localhost:8000
   curl -fsS "$CAREERPILOT_API/api/job-boards" | jq --arg d "<domain>" '.data[] | select(.domain == $d)'
   ```

   If no row matches, abort with: "Board `<domain>` is not configured. Add it on /boards or run again with a different `--board`." When a `--campaign` id was given, PATCH it to `failed` with `failReason:"Board <domain> not configured"` first.

## Phase 1: Parse Query

Extract title/role, keywords, location, other preferences (e.g. "no startups", "FAANG only", salary). If vague, ask before searching.

## Phase 2: Search the Board

1. `browser_navigate` to the resolved board's `searchUrl`.
2. Follow `../shared/auth.md` to log in proactively.
3. Fill the search fields and submit.
4. Take a `browser_snapshot` narrowed to the results list (per `../shared/browser-tips.md`) and read `{ title, company, location, url, postedAt }` per row.
5. Take the first `--max-jobs` results (default 15). If fewer are available, take what's there. Only if a brief description is needed for the ranked table AND the listing preview didn't include one, `browser_navigate` into the posting and `browser_snapshot` its body for the detail. Otherwise skip the per-job nav to save tokens.

## Phase 3: Exclude Previously Applied

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
TITLE_ENCODED=$(jq -rn --arg v "<title>" '$v|@uri')
COMPANY_ENCODED=$(jq -rn --arg v "<company>" '$v|@uri')
curl -fsS "$CAREERPILOT_API/api/applied/check?url=$URL_ENCODED&title=$TITLE_ENCODED&company=$COMPANY_ENCODED"
```

If `data.applied`, tag with "Previously Applied" (note `data.match.kind`: `url` for exact, `fuzzy` with score for title+company). These are saved as `skipped` in Phase 5, not offered for apply.

## Phase 4: Fit Review

For each non-applied result, score 0–100 based on: tech stack overlap, years vs candidate, education match, domain/industry relevance, seniority alignment.

## Phase 4.5: Posting Legitimacy Check

Before saving, screen each result for scam/ghost-job signals so the user (or `auto-apply`, which can submit unattended) doesn't spend effort on postings unlikely to lead anywhere. Present observations, not accusations — every signal has legitimate explanations.

**Signals** (from what you already have — the listing snapshot, the JD text, and `/api/applied/check`'s history; don't run extra searches just for this):
- **Freshness**: date posted / "X days ago", apply button state (active vs closed vs redirects to a generic careers page).
- **Description quality**: names specific technologies/team/scope, vs generic boilerplate; realistic requirements (years of experience vs how old the tech is); salary mentioned; internal contradictions (e.g. entry-level title with staff-level requirements).
- **Reposting**: same company + a very similar title seen again recently (check via `/api/applied/check`'s fuzzy match) — repeated reposting of the same role can indicate a role that never actually closes.

**Tier the result:**
- **High Confidence** — multiple signals suggest a real, active opening.
- **Proceed with Caution** — mixed signals worth noting.
- **Suspicious** — multiple ghost-job indicators.

**Edge cases — don't over-flag:** government/academic postings and niche/staff+/executive roles legitimately stay open for months; "ongoing"/"rolling" postings are pipeline roles, not ghost jobs; early-stage startups may have vague JDs because the role is genuinely undefined. When no freshness signal is available and nothing else is concerning, default to "Proceed with Caution" — never default to "Suspicious" without an actual signal.

Include the tier in `matchReason` (e.g. "82/100 — strong tech match; posting: Proceed with Caution, no salary listed and vague scope"). `auto-apply` must treat "Suspicious" as a **skip**, never an auto-submit, regardless of score.

## Phase 5: Save Results to the Campaign

Save every result as a `Job` on `<campaign-id>` so it appears on the campaigns detail page. **Don't offer apply/search-again commands** — the user applies from there. Use a stable, shell-safe `key` per result (slug of `company-title` + rank, no spaces).

```bash
curl -fsS -X POST "$CAREERPILOT_API/api/campaigns/<campaign-id>/jobs" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg key "<key>" --arg title "<title>" --arg company "<company>" \
    --arg location "<location>" --arg url "<job-url>" --arg board "<domain>" \
    --arg matchReason "<one-line verdict>" --argjson score <0-100> \
    '{key:$key, title:$title, company:$company, location:$location, url:$url, board:$board, matchScore:$score, matchReason:$matchReason, status:"pending"}')"
```

Previously-applied results (Phase 3) → save with `status:"skipped"`, `skipReason:"Already applied (<kind>)"`. Then close the campaign:

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -fsS -X PATCH "$CAREERPILOT_API/api/campaigns/<campaign-id>" \
  -H 'content-type: application/json' \
  -d "$(jq -n --argjson found <total> --argjson qualified <pending_count> --arg t "$NOW" \
    '{status:"completed", completedAt:$t, summary:{totalFound:$found, qualified:$qualified}}')"
```

## Phase 6: Hand Off

Print a compact ranked table, then link to the campaign — nothing else:

```
## Saved <N> jobs · "[query]" — review and apply at http://localhost:8000/campaigns/<campaign-id>

| # | Score | Title | Company | Location |
|---|-------|-------|---------|----------|
```

## Rules

1. **Exactly one board per campaign** — the `--board` flag is required and the skill targets only that board.
2. **Account handling** — follow `../shared/auth.md`. If login fails because the account doesn't exist, the auth flow registers one with the stored credentials.
3. **Handle rate limiting** — if blocked, note it and continue.
4. **Be honest about scores.** 50/100 is a stretch — label it as such.
5. **Deduplicate** within the board.

Read `../shared/browser-tips.md` for large pages, popups, and browser best practices.
