import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

import { DEFAULT_WEB_ORIGIN, SESSION_DIR, SESSION_PATH, type SessionRecord } from "./config.js";

export async function ensureSessionDir() {
  await mkdir(SESSION_DIR, { recursive: true });
}

export async function writeSession(session: SessionRecord) {
  await ensureSessionDir();
  await writeFile(SESSION_PATH, `${JSON.stringify(session, null, 2)}\n`, "utf8");
}

export async function readSession(): Promise<SessionRecord | null> {
  try {
    const raw = await readFile(SESSION_PATH, "utf8");
    return JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
}

export function openBrowser(url: string) {
  const platform = process.platform;
  const command = platform === "darwin"
    ? "open"
    : platform === "win32"
      ? "cmd"
      : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

export async function login(flags: Record<string, string>, logger: (message: string) => void = console.log): Promise<SessionRecord> {
  const origin = flags.origin ?? DEFAULT_WEB_ORIGIN;
  if (flags.token) {
    const session = {
      origin,
      accessToken: flags.token,
      createdAt: new Date().toISOString(),
    } satisfies SessionRecord;
    await writeSession(session);
    logger("Saved RESEARCH CLI session from provided token.");
    return session;
  }

  const state = crypto.randomUUID();
  const port = Number(flags.port ?? "43119");
  const callbackPath = "/cli/callback";
  const callbackUrl = `http://127.0.0.1:${port}${callbackPath}`;
  const loginUrl = new URL("/cli/login", origin);
  loginUrl.searchParams.set("state", state);
  loginUrl.searchParams.set("redirect_uri", callbackUrl);
  loginUrl.searchParams.set("client", "research-cli");

  const token = await new Promise<string>((resolve, reject) => {
    const server = createServer((request, response) => {
      const requestUrl = new URL(request.url ?? "/", callbackUrl);
      if (requestUrl.pathname !== callbackPath) {
        response.statusCode = 404;
        response.end("Not found");
        return;
      }
      const returnedState = requestUrl.searchParams.get("state");
      const accessToken = requestUrl.searchParams.get("token");
      if (returnedState !== state || !accessToken) {
        response.statusCode = 400;
        response.end("Missing or invalid auth callback");
        server.close();
        reject(new Error("Invalid RESEARCH auth callback"));
        return;
      }
      response.statusCode = 200;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end("<html><body><h1>RESEARCH CLI login complete</h1><p>You can return to your terminal.</p></body></html>");
      server.close();
      resolve(accessToken);
    });
    server.listen(port, "127.0.0.1", () => {
      logger(`Opening RESEARCH login in browser: ${loginUrl.toString()}`);
      logger("If the browser does not open, visit this URL manually:");
      logger(loginUrl.toString());
      try {
        openBrowser(loginUrl.toString());
      } catch {
        // Manual fallback already printed.
      }
    });
    server.on("error", reject);
  });

  const session = {
    origin,
    accessToken: token,
    createdAt: new Date().toISOString(),
  } satisfies SessionRecord;
  await writeSession(session);
  logger("Saved RESEARCH CLI session.");
  return session;
}
