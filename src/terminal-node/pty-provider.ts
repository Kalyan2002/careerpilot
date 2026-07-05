/**
 * Thin wrapper around node-pty, forced into winpty mode (`useConpty: false`)
 * to match the .NET terminal bridge's deliberate choice of winpty over
 * ConPTY — the client's xterm.js is configured with `windowsPty: {backend:
 * "winpty"}`, and ConPTY has had rendering bugs on some Windows 11 builds
 * that winpty's screen-scraping approach avoids. Verified on this machine:
 * both ConPTY and winpty modes spawn cleanly, but winpty is kept to match
 * the frontend's existing expectation and the original bridge's rationale.
 */
import * as pty from "node-pty";

export class PtyStartError extends Error {
  constructor(command: string, cause: unknown) {
    super(`Failed to start '${command}': ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

export class PtyProcess {
  private readonly proc: pty.IPty;

  constructor(
    command: string,
    args: string[],
    cwd: string,
    cols: number,
    rows: number,
    env: Record<string, string>,
    onData: (data: Buffer) => void,
    onExit: (code: number) => void,
  ) {
    const mergedEnv: Record<string, string> = {
      ...(process.env as Record<string, string>),
      TERM: "xterm-256color",
      // Force a UTF-8 locale so the spawned shell/tools (bash, jq, curl) read and write
      // input as UTF-8 instead of the system code page — otherwise non-ASCII punctuation
      // an agent types (em-dashes, smart quotes) is mangled to the replacement char.
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      PYTHONUTF8: "1",
      ...env,
    };

    try {
      this.proc = pty.spawn(command, args, {
        name: "xterm-256color",
        cols,
        rows,
        cwd,
        env: mergedEnv,
        useConpty: false,
      });
    } catch (e) {
      throw new PtyStartError(command, e);
    }

    this.proc.onData((data) => onData(Buffer.from(data, "utf8")));
    this.proc.onExit(({ exitCode }) => onExit(exitCode));
  }

  write(data: Buffer): void {
    this.proc.write(data.toString("utf8"));
  }

  resize(cols: number, rows: number): void {
    try {
      this.proc.resize(cols, rows);
    } catch {
      // ignore resize races against an already-exited process
    }
  }

  dispose(): void {
    try {
      this.proc.kill();
    } catch {
      // already exited
    }
  }
}
