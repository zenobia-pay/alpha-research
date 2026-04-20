#!/usr/bin/env node
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

import {
  aggregateRecords,
  buildTextCompatibleDocuments,
  describeDataset,
  queryDataset,
  type DatasetFilter,
} from "@alpha-datasets/core";
import { getFixtureAdapter } from "@alpha-datasets/fixture";
import {
  aggregateInstance,
  buildTextCompatibleDocumentsForInstance,
  getInstanceBootstrap,
  listInstanceBundles,
  queryInstance,
} from "@alpha-datasets/storage";

type SessionRecord = {
  origin: string;
  accessToken: string;
  createdAt: string;
};

const SESSION_DIR = join(homedir(), ".research");
const SESSION_PATH = join(SESSION_DIR, "session.json");
const DEFAULT_WEB_ORIGIN = process.env.ALPHA_RESEARCH_WEB_ORIGIN ?? "https://alpharesearch.nyc";
const DEFAULT_INSTALL_URL = process.env.ALPHA_RESEARCH_INSTALL_URL
  ?? "https://raw.githubusercontent.com/zenobia-pay/alpha-research/codex/initial-substrate/scripts/install_alpha_research.sh";
const DEFAULT_INSTANCE_ROOT = process.env.DATASET_INSTANCE_ROOT
  ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/instances");
const INGEST_SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../scripts/normalize_dataset.py");

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token?.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = "true";
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return flags;
}

function parseFilter(filterArg: string): DatasetFilter {
  const [field, op, ...valueParts] = filterArg.split(":");
  const valueText = valueParts.join(":");
  if (!field || !op || valueText.length === 0) {
    throw new Error(`Invalid filter: ${filterArg}`);
  }
  const numericValue = Number(valueText);
  const value = Number.isFinite(numericValue) && valueText.trim() !== "" ? numericValue : valueText;
  return {
    field,
    op: op as DatasetFilter["op"],
    value,
  };
}

function printUsage() {
  console.log([
    "research",
    "",
    "Commands:",
    "  install-prompt --dataset <path> [--mode auto|tabular|unstructured] [--name <name>] [--id <instance-id>]",
    "  login [--origin <web-origin>] [--token <token>]",
    "  whoami",
    "  instances [--root <dir>]",
    "  describe-instance <instance-id> [--root <dir>]",
    "  query-instance <instance-id> [--root <dir>] [--text <query>] [--filter <field:eq:value>]",
    "  aggregate-instance <instance-id> --group-by <field> --measure <field> [--root <dir>] [--op <op>]",
    "  documents-instance <instance-id> [--root <dir>]",
    "  ingest --mode <auto|tabular|unstructured> --input <path> --id <instance-id> --name <product-name> [additional flags]",
    "  fixture describe <dataset-id>",
    "  fixture preview <dataset-id>",
    "  fixture query <dataset-id> [--text <query>] [--filter <field:eq:value>]",
    "  fixture aggregate <dataset-id> --group-by <field> --measure <field> [--op <op>]",
    "  fixture documents <dataset-id>",
  ].join("\n"));
}

async function ensureSessionDir() {
  await mkdir(SESSION_DIR, { recursive: true });
}

async function writeSession(session: SessionRecord) {
  await ensureSessionDir();
  await writeFile(SESSION_PATH, `${JSON.stringify(session, null, 2)}\n`, "utf8");
}

async function readSession(): Promise<SessionRecord | null> {
  try {
    const raw = await readFile(SESSION_PATH, "utf8");
    return JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
}

function openBrowser(url: string) {
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

async function login(flags: Record<string, string>) {
  const origin = flags.origin ?? DEFAULT_WEB_ORIGIN;
  if (flags.token) {
    await writeSession({
      origin,
      accessToken: flags.token,
      createdAt: new Date().toISOString(),
    });
    console.log("Saved RESEARCH CLI session from provided token.");
    return;
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
    const server = createServer(async (request, response) => {
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
      console.log(`Opening RESEARCH login in browser: ${loginUrl.toString()}`);
      console.log("If the browser does not open, visit this URL manually:");
      console.log(loginUrl.toString());
      try {
        openBrowser(loginUrl.toString());
      } catch {
        // Manual fallback already printed.
      }
    });
    server.on("error", reject);
  });

  await writeSession({
    origin,
    accessToken: token,
    createdAt: new Date().toISOString(),
  });
  console.log("Saved RESEARCH CLI session.");
}

async function runIngest(args: string[]) {
  const python = process.env.PYTHON_BIN ?? "python3";
  console.log(`Starting RESEARCH ingest via ${python} ${INGEST_SCRIPT}`);
  if (args.length > 0) {
    console.log(`Arguments: ${args.join(" ")}`);
  }
  const child = spawn(python, [INGEST_SCRIPT, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  await new Promise<void>((resolve, reject) => {
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`normalize_dataset.py exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

function buildInstallPrompt(flags: Record<string, string>) {
  const dataset = flags.dataset ?? "<ABSOLUTE_DATASET_PATH>";
  const mode = flags.mode ?? "auto";
  const name = flags.name ?? "My Dataset";
  const id = flags.id ?? "my-dataset";
  const datasetId = flags["dataset-id"] ?? id;
  return [
    "Copy this to your agent:",
    "",
    "Install the RESEARCH CLI, log in if needed, and ingest my dataset into a local Alpha Research instance.",
    "",
    `Run: curl -fsSL ${DEFAULT_INSTALL_URL} | bash`,
    "",
    "Then run:",
    `research ingest --mode ${mode} --input "${dataset}" --id ${id} --name "${name}" --dataset-id ${datasetId}`,
    "",
    "After ingest finishes, tell me which instance bundle was created and how to launch the local stack.",
  ].join("\n");
}

async function handleFixture(command: string, datasetId: string | undefined, flags: Record<string, string>) {
  if (!command || !datasetId) {
    throw new Error("fixture requires a subcommand and dataset id");
  }
  const adapter = getFixtureAdapter(datasetId);
  if (!adapter) {
    throw new Error(`Unknown fixture dataset: ${datasetId}`);
  }
  if (command === "describe") {
    console.log(describeDataset(adapter));
    return;
  }
  if (command === "preview") {
    console.log(JSON.stringify(await adapter.listRecords(), null, 2));
    return;
  }
  if (command === "query") {
    const filters = flags.filter ? [parseFilter(flags.filter)] : [];
    console.log(JSON.stringify(await queryDataset(adapter, { text: flags.text, filters }), null, 2));
    return;
  }
  if (command === "aggregate") {
    if (!flags["group-by"] || !flags.measure) {
      throw new Error("fixture aggregate requires --group-by and --measure");
    }
    const records = await adapter.listRecords();
    console.log(JSON.stringify(aggregateRecords(records, {
      groupBy: flags["group-by"],
      measure: flags.measure,
      op: (flags.op as "sum" | "avg" | "min" | "max" | "count" | undefined) ?? "sum",
    }), null, 2));
    return;
  }
  if (command === "documents") {
    const records = await adapter.listRecords();
    console.log(JSON.stringify(buildTextCompatibleDocuments(adapter, records), null, 2));
    return;
  }
  throw new Error(`Unknown fixture command: ${command}`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  if (!command || command === "help" || command === "--help") {
    printUsage();
    return;
  }

  if (command === "install-prompt") {
    console.log(buildInstallPrompt(flags));
    return;
  }

  if (command === "login") {
    await login(flags);
    return;
  }

  if (command === "whoami") {
    const session = await readSession();
    if (!session) {
      console.log("No RESEARCH CLI session found.");
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify({
      origin: session.origin,
      createdAt: session.createdAt,
      accessTokenPreview: `${session.accessToken.slice(0, 8)}...`,
    }, null, 2));
    return;
  }

  if (command === "ingest") {
    await runIngest(rest);
    return;
  }

  if (command === "instances") {
    console.log(JSON.stringify({
      root: flags.root ?? DEFAULT_INSTANCE_ROOT,
      instances: await listInstanceBundles(flags.root ?? DEFAULT_INSTANCE_ROOT),
    }, null, 2));
    return;
  }

  if (command === "describe-instance") {
    const instanceId = rest[0];
    if (!instanceId) {
      throw new Error("describe-instance requires <instance-id>");
    }
    console.log(JSON.stringify(
      await getInstanceBootstrap(flags.root ?? DEFAULT_INSTANCE_ROOT, instanceId),
      null,
      2,
    ));
    return;
  }

  if (command === "query-instance") {
    const instanceId = rest[0];
    if (!instanceId) {
      throw new Error("query-instance requires <instance-id>");
    }
    const filters = flags.filter ? [parseFilter(flags.filter)] : [];
    console.log(JSON.stringify(await queryInstance(flags.root ?? DEFAULT_INSTANCE_ROOT, instanceId, {
      text: flags.text,
      filters,
      limit: flags.limit ? Number(flags.limit) : undefined,
    }), null, 2));
    return;
  }

  if (command === "aggregate-instance") {
    const instanceId = rest[0];
    if (!instanceId) {
      throw new Error("aggregate-instance requires <instance-id>");
    }
    if (!flags["group-by"] || !flags.measure) {
      throw new Error("aggregate-instance requires --group-by and --measure");
    }
    const filters = flags.filter ? [parseFilter(flags.filter)] : [];
    console.log(JSON.stringify(await aggregateInstance(flags.root ?? DEFAULT_INSTANCE_ROOT, instanceId, {
      groupBy: flags["group-by"],
      measure: flags.measure,
      op: (flags.op as "sum" | "avg" | "min" | "max" | "count" | undefined) ?? "sum",
      limit: flags.limit ? Number(flags.limit) : undefined,
      filters,
    }), null, 2));
    return;
  }

  if (command === "documents-instance") {
    const instanceId = rest[0];
    if (!instanceId) {
      throw new Error("documents-instance requires <instance-id>");
    }
    console.log(JSON.stringify(
      await buildTextCompatibleDocumentsForInstance(
        flags.root ?? DEFAULT_INSTANCE_ROOT,
        instanceId,
        flags.limit ? Number(flags.limit) : undefined,
      ),
      null,
      2,
    ));
    return;
  }

  if (command === "fixture") {
    const [fixtureCommand, datasetId, ...tail] = rest;
    await handleFixture(fixtureCommand, datasetId, parseFlags(tail));
    return;
  }

  printUsage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
