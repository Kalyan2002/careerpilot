/**
 * Ported from the .NET terminal bridge's TerminalSessionPaths.cs — resolves
 * the repo's plugin/skills layout and builds provider launch specs.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type TerminalProviderId = "claude" | "codex";

export interface TerminalProviderInfo {
  id: TerminalProviderId;
  displayName: string;
}

export const PROVIDERS: TerminalProviderInfo[] = [
  { id: "claude", displayName: "Claude Code" },
  { id: "codex", displayName: "Codex" },
];

export function normalizeProvider(provider: string | undefined | null): TerminalProviderId {
  const p = provider?.trim().toLowerCase();
  if (!p || p === "claude") return "claude";
  if (p === "codex") return "codex";
  throw new Error(`Unsupported terminal provider '${provider}'`);
}

export function displayNameFor(provider: TerminalProviderId): string {
  return provider === "claude" ? "Claude Code" : "Codex";
}

export interface TerminalLaunchSpec {
  provider: TerminalProviderInfo;
  command: string;
  args: string[];
}

export interface TerminalSessionPaths {
  workingDir: string;
  sharedSkillsDir: string;
  pluginDir: string;
}

function* ancestors(path: string): Generator<string> {
  let dir = resolve(path);
  for (;;) {
    yield dir;
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

function isSharedSkillsDir(path: string): boolean {
  return existsSync(join(path, "shared", "setup.md")) && existsSync(join(path, "auto-apply", "SKILL.md"));
}

function isClaudePluginDir(path: string): boolean {
  return existsSync(join(path, ".claude-plugin", "plugin.json"));
}

function isCodexPluginDir(path: string): boolean {
  return existsSync(join(path, ".codex-plugin", "plugin.json"));
}

/** Finds the repo's plugin/ directory (skills/, .claude-plugin/, .codex-plugin/) from cwd or this module's own location. */
export function resolveSessionPaths(): TerminalSessionPaths {
  const candidates = new Set<string>();
  for (const root of ancestors(process.cwd())) candidates.add(root);
  for (const root of ancestors(import.meta.dir)) candidates.add(root);

  for (const root of candidates) {
    const pluginDir = join(root, "plugin");
    const skillsDir = join(pluginDir, "skills");
    if (isSharedSkillsDir(skillsDir) && isClaudePluginDir(pluginDir) && isCodexPluginDir(pluginDir)) {
      return { workingDir: root, sharedSkillsDir: skillsDir, pluginDir };
    }
  }

  throw new Error(
    "Could not find CareerPilot provider assets: a plugin/ directory with skills/, .claude-plugin/, and .codex-plugin/.",
  );
}

export function resolveWorkingDir(paths: TerminalSessionPaths, requested: string | undefined | null): string {
  if (!requested || !requested.trim()) return paths.workingDir;
  return resolve(requested);
}

export function getLaunchSpec(
  paths: TerminalSessionPaths,
  provider: string | undefined | null,
  workingDir: string,
): TerminalLaunchSpec {
  const normalized = normalizeProvider(provider);
  const info: TerminalProviderInfo = { id: normalized, displayName: displayNameFor(normalized) };

  if (normalized === "claude") {
    return {
      provider: info,
      command: "cmd.exe",
      args: ["/c", "claude", "--dangerously-skip-permissions", "--plugin-dir", paths.pluginDir],
    };
  }
  return { provider: info, command: "codex", args: ["--no-alt-screen", "-C", workingDir] };
}
