# CareerPilot

Local AI job-application app (merge of jobpilot (upstream: suxrobgm/jobpilot) + career-ops). Uses Claude Code or Codex as the provider, a Next.js + SQLite web app at `http://localhost:8000` for state, and a Bun/node-pty PTY host at `:8001` for the embedded terminal.

## Layout

- `plugin/` — the CareerPilot plugin, loaded by Claude (`--plugin-dir plugin`) and Codex (via `.agents/plugins/marketplace.json` → `./plugin`). One tree serves both providers — no generation step.
  - `plugin/.claude-plugin/plugin.json` & `plugin/.codex-plugin/plugin.json` — provider manifests (both name the plugin `careerpilot`).
  - `plugin/.mcp.json` — Playwright MCP wiring, shared by both providers.
  - `plugin/skills/<name>/SKILL.md` — one hand-authored, provider-neutral skill per directory; `plugin/skills/shared/*.md` — shared docs. **Edit here directly.**
- `src/web/` — Bun + Next.js 16 + MUI 9 + Prisma 7 + TanStack Query/Form + Zod v4. Owns all persistence (SQLite at `prisma/app.db`, resumes at `storage/resumes/`).
- `src/terminal-node/` — Bun/TypeScript service hosting one provider PTY via node-pty (winpty mode, matching the frontend's `windowsPty: {backend: "winpty"}` xterm.js setting). Exposes `/ws`, `/sessions/start`, `/sessions/inject`, `/sessions/current`, `/healthz` — same contract as the original .NET bridge it replaced.

## Commands

Root (`bun run …`):

- `dev` — runs terminal (`:8001`) + web (`:8000`) together.
- `db:setup` — generate Prisma client, apply migrations, seed default boards.
- `build:web` — production build (the terminal host runs from source via Bun; no build step).

Web (`bun --cwd=src/web run …`):

- `lint`, `typecheck`, `format` — Next lint, `tsc --noEmit`, Prettier.
- `typegen` — Next route/type generation.
- `db:generate`, `db:migrate` (create-only), `db:migrate:apply`, `db:seed`, `db:reset`, `db:studio`.

## Skill conventions

- One tree, both providers. Skills are provider-neutral: reference sibling skills by name (e.g. "invoke the `tailor-resume` skill"), not provider-specific command tokens, and reference shared docs by path-relative reference (`../shared/<doc>.md`). Claude extras like `allowed-tools` are fine in frontmatter — Codex ignores unknown keys.
- Imperative voice, addressed to the provider.
- Start by checking `GET /api/health`; abort with a clear message if the web app is down.
- Talk to the web app via `curl -fsS "$CAREERPILOT_API/api/..."` (`CAREERPILOT_API=http://localhost:8000`). No direct DB access.
- Load profile/resume/credentials via `plugin/skills/shared/setup.md`.
- Credential lookup: board override → `Credential.scope === <domain>` → `Credential.scope === "default"`.
- Log in proactively before searching/applying.
- Dedupe applied jobs via `GET /api/applied/check` (exact URL + fuzzy title+company, 30-day window).
- During campaigns, `PATCH /api/campaigns/[id]/jobs/[jobKey]` for non-terminal status transitions (pending → approved → applying). On terminal outcome (applied / failed / skipped), `POST /api/campaigns/[id]/jobs/[jobKey]/result` — one call updates the Job, creates the Application row (when applied), marks the queue entry, and recomputes the campaign summary.
- Browser automation: use `browser_snapshot` (with `ref` for large pages), not screenshots.

## API & module layout (`src/web/src/`)

- **`app/api/**/route.ts` are thin adapters only** — no business logic, no manual parsing/envelope/try-catch. Each handler declares Zod contracts and delegates to a `server/<domain>` service.
- **Route kernel** (`server/api/route.ts`): wrap handlers in `api.route(config, handler)`. Profile-scoped routes are the default and inject `profileId`; public routes must pass `{ public: true }`. `config: { public?, params?, query?, body?: ZodType, status? }`. Handlers receive `{ req, params, query, body, profileId }` for profile routes, or `{ req, params, query, body }` for public routes, and **return plain data** (auto-wrapped in the `ok` envelope) or a raw `Response` (escape hatch for SSE/file streams/redirects/cookies). The kernel maps errors: `HttpError`→its status, `ZodError`→422, Prisma `P2002`→409, unknown→logged 500 (never rethrown — preserves the JSON envelope contract).
- **Errors**: `throw notFound(msg)` / `conflict(msg)` / `badRequest(msg)` or `new HttpError(code, msg, status)` from `server/api/errors`. Ownership-or-404: `findOwned((where) => db.X.findFirst({ where }), { id, profileId }, "Label")` from `server/api/owned`.
- **Params/query parsing is Zod**, not hand-rolled utils: numeric id via `idParam` (`lib/contracts/shared`); query filters as an inline `z.object({...})` with `z.coerce`/`.trim()`/`.catch()`. Success status defaults to **200** (no 201).
- **`src/server/**` = server-only** (db, fs, secrets, domain services) — guarded by `import "server-only"`; never imported by client code. Domains: `server/{campaigns,resumes,email,scoring,pdf,outreach,analytics,pipeline}`, plus `server/{db,active-profile,storage}` and the `server/api` kernel.
- **`src/lib/contracts/`** = Zod schemas shared by routes **and** client forms (the only schemas both sides import). **`src/lib/client/`** = `"use client"` helpers (`api.ts` fetch wrapper, `query-keys.ts`, `resume-urls.ts`). **`src/lib/api/envelope.ts`** = neutral envelope types both sides import. `src/lib/sse/` stays put (directive-split server/client/types).
- Adding a route: add/reuse a schema in `lib/contracts`, write `export const GET = api.route({...}, …)`, put non-trivial logic in `server/<domain>`.

## Frontend conventions (`src/web/src/`)

- **Files**: kebab-case (`auth-card.tsx`, `use-auth.ts`). No PascalCase filenames.
- **Exports**: named for components/hooks/providers. Default exports only for `page.tsx` / `layout.tsx`.
- **RSC by default**: never put `"use client"` in pages or layouts — extract interactivity into `src/components/features/`.
- **Props**: `interface <Name>Props` (not `type`). Destructure inside the body, not in parameters.
- **Conditional render**: `cond && <X />` rather than `cond ? <X /> : null`.
- **MUI**: barrel imports (`import { Button } from "@mui/material"`), never deep imports.
- **Aliases**: `@/` maps to `src/` (e.g. `@/hooks/use-auth`).
- **Zod**: import from `zod/v4`.
- **Forms**: TanStack Form + Zod validators.
- **React 19**: use the `use()` hook for async data in client components. Never use `useCallback`, `useMemo`, or `memo` — the compiler handles it. Pass `ref` as a regular prop; do **not** use `forwardRef`.

## Styling Guidelines (MUI)

## Key Rules

- **Theme colors only** — never hardcode hex values. Use `"primary.main"`, `"background.paper"`, `"text.secondary"`, etc.
- **Theme spacing** — use numeric units (`p: 2` = 16px), not pixel strings
- **Typography variants** — use `variant="h4"`, not manual `fontSize`/`fontWeight`
- **`sx` prop** for one-off styling. If repeated, extract a component
- **Semantic colors** for dark mode support: `"background.paper"`, `"text.primary"`, `"divider"`

## Forbidden Patterns

- No inline `style={{ }}` — use MUI `sx` prop instead
- No `styled-components` or MUI's `styled()` — use `sx` or extract a component
- No raw `<div>` / `<span>` for layout — use `Box`, `Stack`, `Typography`
