/**
 * CareerPilot.Terminal (Node/Bun) — replaces the .NET/ASP.NET Core terminal
 * bridge. Same HTTP+WS API contract as the original (src/terminal, now
 * removed) so the existing web frontend (lib/terminal.ts, terminal-panel.tsx)
 * needs no changes: GET /healthz, POST /sessions/start, POST /sessions/inject,
 * DELETE /sessions/current, and a /ws upgrade streaming binary PTY output with
 * JSON text control messages ({type:"input"|"resize", ...}) in the other
 * direction.
 */
import { PROVIDERS, type TerminalProviderId } from "./paths";
import { SessionManager, type TerminalClient } from "./session-manager";

// node-pty's Windows write path can emit "Socket is closed" asynchronously
// (an 'error' event on the underlying socket, not a synchronous throw) when a
// write races against an already-exited PTY — see pty-provider.ts's `write()`.
// A synchronous try/catch around that call cannot intercept an async event
// emission, so this process-wide net is the only place left to catch it.
// Everything else is a real bug: log and exit so it's visible rather than
// silently limping along in a broken state.
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function withCors(res: Response): Response {
  res.headers.set("access-control-allow-origin", "*");
  res.headers.set("access-control-allow-headers", "*");
  res.headers.set("access-control-allow-methods", "*");
  return res;
}

interface WsData {
  registered: boolean;
}

const server = Bun.serve<WsData>({
  port: PORT,
  async fetch(req, srv) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    if (url.pathname === "/ws") {
      const upgraded = srv.upgrade(req, { data: { registered: false } });
      if (!upgraded) {
        return withCors(new Response("Expected a WebSocket upgrade", { status: 400 }));
      }
      return undefined as unknown as Response;
    }

    if (url.pathname === "/healthz" && req.method === "GET") {
      return withCors(json(statusBody()));
    }

    if (url.pathname === "/sessions/start" && req.method === "POST") {
      const body = (await req.json()) as { cols: number; rows: number; workingDir?: string; provider?: string };
      try {
        session.start(body.provider, body.workingDir, body.cols, body.rows);
      } catch (e) {
        return withCors(
          json({ title: "Failed to start terminal session", detail: e instanceof Error ? e.message : String(e) }, 500),
        );
      }
      return withCors(json(statusBody()));
    }

    if (url.pathname === "/sessions/inject" && req.method === "POST") {
      const body = (await req.json()) as { command: string; provider?: TerminalProviderId };
      const injected = await session.inject(body.command, body.provider);
      if (!injected) {
        return withCors(
          json(
            {
              title: "Inject rejected",
              detail: "The session is not running or the active provider does not match the requested provider.",
            },
            409,
          ),
        );
      }
      return withCors(new Response(null, { status: 200 }));
    }

    if (url.pathname === "/sessions/current" && req.method === "DELETE") {
      session.stop();
      return withCors(json(statusBody()));
    }

    return withCors(new Response("Not found", { status: 404 }));
  },
  websocket: {
    open(ws) {
      const client: TerminalClient = {
        send: (data) => ws.send(data),
        get readyState() {
          return ws.readyState;
        },
      };
      (ws.data as WsData & { client?: TerminalClient }).client = client;
      (ws.data as WsData).registered = true;
      session.registerClient(client);
    },
    message(ws, message) {
      if (typeof message !== "string") return; // PTY output only flows server -> client
      try {
        const parsed = JSON.parse(message) as { type: string; data?: string; cols?: number; rows?: number };
        if (parsed.type === "input" && parsed.data) {
          session.writeInput(Buffer.from(parsed.data, "base64"));
        } else if (parsed.type === "resize" && parsed.cols && parsed.rows) {
          session.resize(parsed.cols, parsed.rows);
        }
      } catch {
        // ignore malformed control messages
      }
    },
    close(ws) {
      const client = (ws.data as WsData & { client?: TerminalClient }).client;
      if (client) session.unregisterClient(client);
    },
  },
});

process.on("SIGINT", () => {
  session.stop();
  server.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  session.stop();
  server.stop();
  process.exit(0);
});

console.log(`CareerPilot.Terminal listening on http://localhost:${PORT}`);
