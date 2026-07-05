/**
 * CareerPilot.Terminal (Node) — replaces the .NET/ASP.NET Core terminal
 * bridge. Same HTTP+WS API contract as the original (src/terminal, now
 * removed) so the existing web frontend (lib/terminal.ts, terminal-panel.tsx)
 * needs no changes: GET /healthz, POST /sessions/start, POST /sessions/inject,
 * DELETE /sessions/current, and a /ws upgrade streaming binary PTY output with
 * JSON text control messages ({type:"input"|"resize", ...}) in the other
 * direction.
 *
 * Runs under plain Node, not Bun: node-pty's Windows write path
 * (winpty and ConPTY alike) throws an async ERR_SOCKET_CLOSED error under
 * Bun's runtime even against a live, running process — a Bun/native-addon
 * compatibility gap, not a real race condition. Verified fixed by switching
 * the runtime to Node while keeping node-pty itself unchanged.
 */
import { createServer } from "node:http";
import { PROVIDERS, type TerminalProviderId } from "./paths.ts";
import { SessionManager, type TerminalClient } from "./session-manager.ts";
import { WebSocketServer, type WebSocket } from "ws";

// Defense-in-depth: a write racing a genuine process exit (distinct from the
// Bun-runtime bug above, which this file's move to Node already fixes) can
// still emit this asynchronously in a way a synchronous try/catch around the
// write call can't intercept (see pty-provider.ts's `write()`).
process.on("uncaughtException", (err: NodeJS.ErrnoException) => {
  if (err?.code === "ERR_SOCKET_CLOSED") {
    console.error("[terminal] ignored a write racing against an already-exited PTY:", err.message);
    return;
  }
  console.error("[terminal] uncaught exception:", err);
  process.exit(1);
});

const PORT = Number(process.env.PORT ?? 8001);
const session = new SessionManager();

function statusBody() {
  return {
    status: "ok",
    session: session.sessionState,
    provider: session.provider,
    providers: PROVIDERS,
  };
}

function withCors(res: import("node:http").ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "*");
  res.setHeader("access-control-allow-methods", "*");
}

function sendJson(res: import("node:http").ServerResponse, body: unknown, status = 200): void {
  withCors(res);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJsonBody<T>(req: import("node:http").IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

const httpServer = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    if (req.method === "OPTIONS") {
      withCors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === "/healthz" && req.method === "GET") {
      sendJson(res, statusBody());
      return;
    }

    if (url.pathname === "/sessions/start" && req.method === "POST") {
      const body = await readJsonBody<{ cols: number; rows: number; workingDir?: string; provider?: string }>(req);
      try {
        session.start(body.provider, body.workingDir, body.cols, body.rows);
      } catch (e) {
        sendJson(
          res,
          { title: "Failed to start terminal session", detail: e instanceof Error ? e.message : String(e) },
          500,
        );
        return;
      }
      sendJson(res, statusBody());
      return;
    }

    if (url.pathname === "/sessions/inject" && req.method === "POST") {
      const body = await readJsonBody<{ command: string; provider?: TerminalProviderId }>(req);
      const injected = await session.inject(body.command, body.provider);
      if (!injected) {
        sendJson(
          res,
          {
            title: "Inject rejected",
            detail: "The session is not running or the active provider does not match the requested provider.",
          },
          409,
        );
        return;
      }
      withCors(res);
      res.writeHead(200);
      res.end();
      return;
    }

    if (url.pathname === "/sessions/current" && req.method === "DELETE") {
      session.stop();
      sendJson(res, statusBody());
      return;
    }

    withCors(res);
    res.writeHead(404);
    res.end("Not found");
  })();
});

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws: WebSocket) => {
  const client: TerminalClient = {
    send: (data) => ws.send(data),
    get readyState() {
      return ws.readyState;
    },
  };
  session.registerClient(client);

  ws.on("message", (message, isBinary) => {
    if (isBinary) return; // PTY output only flows server -> client
    try {
      const parsed = JSON.parse(message.toString("utf8")) as {
        type: string;
        data?: string;
        cols?: number;
        rows?: number;
      };
      if (parsed.type === "input" && parsed.data) {
        session.writeInput(Buffer.from(parsed.data, "base64"));
      } else if (parsed.type === "resize" && parsed.cols && parsed.rows) {
        session.resize(parsed.cols, parsed.rows);
      }
    } catch {
      // ignore malformed control messages
    }
  });

  ws.on("close", () => session.unregisterClient(client));
});

function shutdown(): void {
  session.stop();
  httpServer.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

httpServer.listen(PORT, () => {
  console.log(`CareerPilot.Terminal listening on http://localhost:${PORT}`);
});
