/** Ported from the .NET terminal bridge's SessionManager.cs. */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { extname, join } from "node:path";
import {
  getLaunchSpec,
  normalizeProvider,
  PROVIDERS,
  resolveSessionPaths,
  resolveWorkingDir,
  type TerminalProviderId,
} from "./paths";
import { PtyProcess, PtyStartError } from "./pty-provider";

const PLAYWRIGHT_SCRATCH_EXTENSIONS = new Set([
  ".log",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".md",
  ".json",
  ".yml",
  ".yaml",
]);

/** Pause between writing an injected command's text and its Enter keystroke, so the
 * provider TUI reads the submit key separately instead of folding it into a paste. */
const SUBMIT_KEY_DELAY_MS = 75;

export type SessionState = "stopped" | "running";

export interface TerminalClient {
  send(data: Buffer): void;
  readyState: number;
}

const OPEN = 1;

export class SessionManager {
  private pty: PtyProcess | null = null;
  private state: SessionState = "stopped";
  private activeProvider: TerminalProviderId = "claude";
  private suppressNextExitMessage = false;
  private readonly clients = new Set<TerminalClient>();
  private readonly paths = resolveSessionPaths();

  get sessionState(): SessionState {
    return this.state;
  }

  get provider(): TerminalProviderId {
    return this.activeProvider;
  }

  static get providers() {
    return PROVIDERS;
  }

  start(provider: string | undefined | null, requestedWorkingDir: string | undefined | null, cols: number, rows: number): void {
    const normalized = normalizeProvider(provider);
    if (this.state === "running" && this.activeProvider === normalized) {
      return; // already running this provider — no-op
    }

    if (this.state === "running") {
      this.suppressNextExitMessage = true;
      this.pty?.dispose();
      this.pty = null;
      this.state = "stopped";
    }

    const workingDir = resolveWorkingDir(this.paths, requestedWorkingDir);
    this.cleanPlaywrightScratch(workingDir);
    const spec = getLaunchSpec(this.paths, normalized, workingDir);

    const env = {
      CAREERPILOT_SKILLS_ROOT: this.paths.sharedSkillsDir,
      CAREERPILOT_WORKSPACE_ROOT: workingDir,
    };

    try {
      this.pty = new PtyProcess(
        spec.command,
        spec.args,
        workingDir,
        cols,
        rows,
        env,
        (data) => this.broadcast(data),
        (code) => this.onPtyExit(code),
      );
    } catch (e) {
      this.state = "stopped";
      if (e instanceof PtyStartError) {
        this.broadcast(Buffer.from(`\x1b[31m${e.message}\x1b[0m\r\n`, "utf8"));
      }
      throw e;
    }

    this.activeProvider = normalized;
    this.state = "running";
  }

  /** Best-effort removal of scratch files (page snapshots, screenshots, downloaded PDFs, console
   * logs) left by Playwright MCP in the previous session. Only top-level files with a known
   * scratch extension are deleted; the browser profile is never touched. */
  private cleanPlaywrightScratch(workingDir: string): void {
    const dir = join(workingDir, ".playwright-mcp");
    if (!existsSync(dir)) return;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!PLAYWRIGHT_SCRATCH_EXTENSIONS.has(extname(entry).toLowerCase())) continue;
      try {
        rmSync(join(dir, entry), { force: true });
      } catch {
        // best-effort — a file still locked by a closing browser is fine to skip
      }
    }
  }

  /** Injects a command line, then submits it with a separate Enter keystroke a beat later so the
   * provider TUI reads it as typed input rather than a paste. */
  async inject(command: string, expectedProvider?: string | null): Promise<boolean> {
    if (!command) return false;
    if (this.state !== "running") return false;

    if (expectedProvider != null) {
      const normalized = normalizeProvider(expectedProvider);
      if (normalized !== this.activeProvider) return false;
    }

    this.pty?.write(Buffer.from(command, "utf8"));
    await new Promise((r) => setTimeout(r, SUBMIT_KEY_DELAY_MS));

    if (this.state !== "running") return false;
    this.pty?.write(Buffer.from("\r", "utf8"));
    return true;
  }

  resize(cols: number, rows: number): void {
    this.pty?.resize(cols, rows);
  }

  writeInput(data: Buffer): void {
    this.pty?.write(data);
  }

  stop(): void {
    if (this.state === "stopped") return;
    this.pty?.dispose();
    this.pty = null;
    this.state = "stopped";
  }

  registerClient(client: TerminalClient): void {
    this.clients.add(client);
  }

  unregisterClient(client: TerminalClient): void {
    this.clients.delete(client);
  }

  private onPtyExit(code: number): void {
    const suppressed = this.suppressNextExitMessage;
    this.suppressNextExitMessage = false;
    if (!suppressed) {
      this.state = "stopped";
    }
    if (suppressed) return;

    const displayName = this.activeProvider === "claude" ? "Claude Code" : "Codex";
    const msg = `\r\n\x1b[31m[CareerPilot.Terminal] ${displayName} exited with code ${code}. Use Restart to reopen.\x1b[0m\r\n`;
    this.broadcast(Buffer.from(msg, "utf8"));
  }

  private broadcast(data: Buffer): void {
    for (const client of this.clients) {
      if (client.readyState !== OPEN) continue;
      try {
        client.send(data);
      } catch {
        // client will be cleaned up on its close event
      }
    }
  }
}
