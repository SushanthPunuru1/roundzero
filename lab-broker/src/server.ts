// HTTP + WS surface. Routes are hand-rolled (4 endpoints total — a router
// dependency would be premature) and wire registry.ts (bookkeeping) +
// docker.ts (the real container driver) + score.ts (report shaping)
// together. No CORS handling: the JSON endpoints are called server-to-server
// from apps/web's server actions (LAB_BROKER_URL never reaches the browser);
// only the terminal WebSocket is browser-direct, and the WebSocket protocol
// isn't subject to CORS.

import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

import { DockerClient, ExecFailedError, MissingPrerequisiteError } from "./docker";
import { LabLimitExceededError, LabNotFoundError, LabRegistry } from "./registry";
import { ScoreParseError, shapeReport } from "./score";

export interface ServerDeps {
  registry: LabRegistry;
  docker: DockerClient;
}

interface ResizeMessage {
  type: "resize";
  cols: number;
  rows: number;
}

function isResizeMessage(value: unknown): value is ResizeMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).type === "resize" &&
    typeof (value as Record<string, unknown>).cols === "number" &&
    typeof (value as Record<string, unknown>).rows === "number"
  );
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(text) });
  res.end(text);
}

function errorStatus(err: unknown): number {
  if (err instanceof LabNotFoundError) return 404;
  if (err instanceof LabLimitExceededError) return 409;
  if (err instanceof MissingPrerequisiteError) return 503;
  if (err instanceof ExecFailedError || err instanceof ScoreParseError) return 502;
  return 500;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

const TERM_PATH = /^\/labs\/([^/]+)\/term$/;

export function createServer({ registry, docker }: ServerDeps): http.Server {
  const server = http.createServer((req, res) => {
    void handleHttp(req, res, { registry, docker });
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const match = TERM_PATH.exec(url.pathname);
    if (!match) {
      socket.destroy();
      return;
    }
    const labId = match[1]!;
    let lab;
    try {
      lab = registry.get(labId);
    } catch {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      void attachTerminal(ws, labId, lab.containerId, { registry, docker });
    });
  });

  return server;
}

async function handleHttp(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  { registry, docker }: ServerDeps,
): Promise<void> {
  const url = new URL(req.url ?? "", "http://localhost");
  const method = req.method ?? "GET";

  try {
    if (method === "POST" && url.pathname === "/labs") {
      const lab = await registry.create();
      sendJson(res, 201, { id: lab.id });
      return;
    }

    const scoreMatch = /^\/labs\/([^/]+)\/score$/.exec(url.pathname);
    if (method === "POST" && scoreMatch) {
      const labId = scoreMatch[1]!;
      const lab = registry.get(labId);
      registry.touch(labId);
      const raw = await docker.runScore(lab.containerId);
      const report = shapeReport(raw);
      sendJson(res, 200, report);
      return;
    }

    const labMatch = /^\/labs\/([^/]+)$/.exec(url.pathname);
    if (method === "DELETE" && labMatch) {
      const labId = labMatch[1]!;
      await registry.delete(labId);
      res.writeHead(204).end();
      return;
    }

    if (method === "GET" && url.pathname === "/labs") {
      sendJson(res, 200, { labs: registry.list().map((lab) => ({ id: lab.id })) });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    sendJson(res, errorStatus(err), { error: errorMessage(err) });
  }
}

async function attachTerminal(
  ws: WebSocket,
  labId: string,
  containerId: string,
  { registry, docker }: ServerDeps,
): Promise<void> {
  registry.attachSocket(labId);

  // The client (xterm) starts writing the instant its socket reports
  // "open" — an initial resize, then keystrokes. docker.openShell() below
  // is a real Docker exec-create call and doesn't resolve instantly, so the
  // message listener must be live *before* that await starts: otherwise
  // whatever the client sends in that window fires "message" with no
  // listener attached yet and Node just drops it (EventEmitter doesn't
  // queue). Buffer input until the shell exists, then flush it.
  const pendingInput: Buffer[] = [];
  const pendingResize: ResizeMessage[] = [];
  let shell: Awaited<ReturnType<typeof docker.openShell>> | null = null;

  ws.on("message", (data, isBinary) => {
    registry.touch(labId);
    if (isBinary) {
      const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      if (shell) shell.stream.write(chunk);
      else pendingInput.push(chunk);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(data.toString("utf8"));
      if (isResizeMessage(parsed)) {
        if (shell) void shell.resize(parsed.cols, parsed.rows);
        else pendingResize.push(parsed);
      }
    } catch {
      // Ignore malformed control messages rather than tearing down the shell.
    }
  });

  let closed = false;
  ws.on("close", () => {
    closed = true;
    registry.detachSocket(labId);
    shell?.stream.destroy();
  });

  try {
    shell = await docker.openShell(containerId);
  } catch (err) {
    ws.send(JSON.stringify({ type: "error", message: errorMessage(err) }));
    ws.close();
    registry.detachSocket(labId);
    return;
  }

  if (closed) {
    // The client disconnected while the exec was still being created.
    shell.stream.destroy();
    return;
  }

  shell.stream.on("data", (chunk: Buffer) => {
    if (ws.readyState === ws.OPEN) ws.send(chunk);
  });
  shell.stream.on("end", () => ws.close());
  shell.stream.on("error", () => ws.close());

  const lastResize = pendingResize.at(-1);
  if (lastResize) void shell.resize(lastResize.cols, lastResize.rows);
  for (const chunk of pendingInput) shell.stream.write(chunk);
}
