#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pluginDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(pluginDir, "../..");
const configuredRoot = resolve(repoRoot, process.env.ALPHA_RESEARCH_REPO_ROOT ?? ".");
const cliDist = resolve(configuredRoot, "apps/cli/dist");

function distUrl(file) {
  return pathToFileURL(resolve(cliDist, file)).href;
}

async function loadCli() {
  if (!existsSync(resolve(cliDist, "remote.js"))) {
    throw new Error(
      `Alpha Research CLI dist files were not found at ${cliDist}. Run npm run build in the alpha-datasets repo before using this plugin.`,
    );
  }
  const [remote, session, runs, config] = await Promise.all([
    import(distUrl("remote.js")),
    import(distUrl("session.js")),
    import(distUrl("runs.js")),
    import(distUrl("config.js")),
  ]);
  return { remote, session, runs, config };
}

const cliPromise = loadCli();

const toolSchemas = [
  {
    name: "research_login_status",
    description: "Show the current Alpha Research CLI login status without exposing tokens.",
    inputSchema: objectSchema({}),
  },
  {
    name: "research_login",
    description: "Start the existing browser login flow and save an Alpha Research CLI session.",
    inputSchema: objectSchema({
      origin: { type: "string", description: "Optional Alpha Research web origin." },
    }),
  },
  {
    name: "research_list_datasets",
    description: "List datasets registered on the Alpha Research control plane.",
    inputSchema: objectSchema({}),
  },
  {
    name: "research_get_dataset",
    description: "Inspect one remote dataset, including profile, deployment status, source coverage, and limitations when available.",
    inputSchema: objectSchema({ datasetId: { type: "string" } }, ["datasetId"]),
  },
  {
    name: "research_list_runs",
    description: "List remote runs, optionally scoped to a dataset.",
    inputSchema: objectSchema({ datasetId: { type: "string" } }),
  },
  {
    name: "research_list_tracked_runs",
    description: "List locally tracked Alpha Research runs from the RESEARCH CLI session directory.",
    inputSchema: objectSchema({}),
  },
  {
    name: "research_start_run",
    description: "Start a typed remote run against a dataset. Use after research design is concrete enough to run.",
    inputSchema: objectSchema({
      datasetId: { type: "string" },
      prompt: { type: "string" },
      type: { type: "string", enum: ["analysis", "fetch", "transform", "label", "hypothesis", "agent", "query", "describe"] },
      config: { type: "object" },
      artifacts: { type: "array", items: { type: "object" } },
    }, ["datasetId", "prompt"]),
  },
  {
    name: "research_start_agent_run",
    description: "Start a remote agent run on a dataset-attached environment and track it locally.",
    inputSchema: objectSchema({
      datasetId: { type: "string" },
      prompt: { type: "string" },
      artifacts: { type: "array", items: { type: "object" } },
    }, ["datasetId", "prompt"]),
  },
  {
    name: "research_continue_agent_run",
    description: "Continue a previous remote agent run when it has a resumable remote agent session artifact.",
    inputSchema: objectSchema({
      runId: { type: "string" },
      prompt: { type: "string" },
      artifacts: { type: "array", items: { type: "object" } },
    }, ["runId", "prompt"]),
  },
  {
    name: "research_wait_for_run",
    description: "Poll a run until it reaches a terminal status or the timeout expires.",
    inputSchema: objectSchema({
      runId: { type: "string" },
      timeoutSeconds: { type: "integer", minimum: 1, maximum: 1800 },
    }, ["runId"]),
  },
  {
    name: "research_get_run_results",
    description: "Retrieve a run with status, events, metadata, and produced/requested artifacts.",
    inputSchema: objectSchema({ runId: { type: "string" } }, ["runId"]),
  },
  {
    name: "research_list_run_artifacts",
    description: "List artifacts for a remote run.",
    inputSchema: objectSchema({ runId: { type: "string" } }, ["runId"]),
  },
  {
    name: "research_cancel_run",
    description: "Cancel an in-progress remote run and terminate its worker when possible.",
    inputSchema: objectSchema({ runId: { type: "string" } }, ["runId"]),
  },
  {
    name: "research_list_research_specs",
    description: "List saved research specs or hypothesis plans, optionally scoped to a dataset.",
    inputSchema: objectSchema({ datasetId: { type: "string" } }),
  },
  {
    name: "research_create_research_spec",
    description: "Save a concrete research design or hypothesis plan for a dataset.",
    inputSchema: objectSchema({
      datasetId: { type: "string" },
      hypothesis: { type: "string" },
      spec: { type: "object" },
      status: { type: "string" },
    }, ["datasetId", "hypothesis"]),
  },
];

function objectSchema(properties, required = []) {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

async function readSessionOrThrow() {
  const { session } = await cliPromise;
  const record = await session.readSession();
  if (!record) {
    throw new Error("Not signed in to Alpha Research. Use research_login first.");
  }
  return record;
}

async function client() {
  const { remote } = await cliPromise;
  return new remote.RemoteApiClient(await readSessionOrThrow());
}

async function track(run) {
  const { runs, config } = await cliPromise;
  const session = await readSessionOrThrow();
  await runs.trackRemoteRun({
    id: run.id,
    datasetId: run.datasetId,
    origin: session.origin,
    status: run.status,
    prompt: run.prompt,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  });
  runs.spawnRunWatcher(run.id);
  return config.dashboardRunUrl(session.origin, run.id);
}

async function runTool(name, input = {}) {
  const { session, runs, config } = await cliPromise;
  switch (name) {
    case "research_login_status": {
      const current = await session.readSession();
      if (!current) return { signedIn: false };
      const api = new (await cliPromise).remote.RemoteApiClient(current);
      const me = await api.getMe().catch((error) => ({ error: String(error.message ?? error) }));
      return { signedIn: true, origin: current.origin, createdAt: current.createdAt, me };
    }
    case "research_login": {
      const flags = input.origin ? { origin: String(input.origin) } : {};
      const saved = await session.login(flags, () => {});
      return { signedIn: true, origin: saved.origin, createdAt: saved.createdAt };
    }
    case "research_list_datasets":
      return await (await client()).listDatasets();
    case "research_get_dataset":
      return await (await client()).getDataset(requiredString(input, "datasetId"));
    case "research_list_runs":
      return await (await client()).listRuns(optionalString(input, "datasetId"));
    case "research_list_tracked_runs":
      return { runs: await runs.readTrackedRuns() };
    case "research_start_run": {
      const api = await client();
      const result = await api.startRun(requiredString(input, "datasetId"), requiredString(input, "prompt"), {
        type: optionalString(input, "type"),
        config: objectOrUndefined(input.config),
        artifacts: arrayOrUndefined(input.artifacts),
      });
      const dashboardUrl = await track(result.run);
      return { ...result, dashboardUrl, pending: true };
    }
    case "research_start_agent_run": {
      const api = await client();
      const result = await api.startRun(requiredString(input, "datasetId"), requiredString(input, "prompt"), {
        type: "agent",
        artifacts: arrayOrUndefined(input.artifacts),
      });
      const dashboardUrl = await track(result.run);
      return { ...result, dashboardUrl, pending: true };
    }
    case "research_continue_agent_run": {
      const api = await client();
      const previous = await api.getRunResults(requiredString(input, "runId"));
      const sessionArtifact = previous.artifacts.find((artifact) => artifact.type === "remote_agent_session");
      const remoteAgentSessionId = sessionArtifact?.content && typeof sessionArtifact.content === "object"
        ? String(sessionArtifact.content.sessionId ?? "")
        : "";
      if (!remoteAgentSessionId) {
        return {
          ok: false,
          reason: "not_resumable",
          run: previous.run,
          producedArtifacts: previous.artifacts.filter((artifact) => artifact.type !== "requested_artifact"),
        };
      }
      const result = await api.startRun(previous.run.datasetId, requiredString(input, "prompt"), {
        type: "agent",
        config: { remoteAgentSessionId, parentRunId: previous.run.id },
        artifacts: arrayOrUndefined(input.artifacts),
      });
      const dashboardUrl = await track(result.run);
      return { ...result, dashboardUrl, remoteAgentSessionId, pending: true };
    }
    case "research_wait_for_run":
      return await waitForRun(requiredString(input, "runId"), Number(input.timeoutSeconds ?? 180));
    case "research_get_run_results": {
      const payload = await (await client()).getRunResults(requiredString(input, "runId"));
      const sessionRecord = await readSessionOrThrow();
      return { ...payload, dashboardUrl: config.dashboardRunUrl(sessionRecord.origin, payload.run.id) };
    }
    case "research_list_run_artifacts":
      return await (await client()).getRunArtifacts(requiredString(input, "runId"));
    case "research_cancel_run": {
      const result = await (await client()).cancelRun(requiredString(input, "runId"));
      await track(result.run);
      return result;
    }
    case "research_list_research_specs":
      return await (await client()).listResearchSpecs(optionalString(input, "datasetId"));
    case "research_create_research_spec":
      return await (await client()).createResearchSpec({
        datasetId: requiredString(input, "datasetId"),
        hypothesis: requiredString(input, "hypothesis"),
        spec: objectOrUndefined(input.spec),
        status: optionalString(input, "status"),
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function waitForRun(runId, timeoutSeconds) {
  const api = await client();
  const { runs } = await cliPromise;
  const deadline = Date.now() + timeoutSeconds * 1000;
  let last = null;
  while (Date.now() <= deadline) {
    const payload = await api.getRunResults(runId);
    last = payload;
    await track(payload.run);
    if (runs.isTerminalRunStatus(payload.run.status)) {
      return { complete: true, ...payload };
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  return { complete: false, ...(last ?? { run: await api.getRun(runId) }) };
}

function requiredString(input, key) {
  const value = input?.[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required string: ${key}`);
  }
  return value;
}

function optionalString(input, key) {
  const value = input?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function objectOrUndefined(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function arrayOrUndefined(value) {
  return Array.isArray(value) ? value : undefined;
}

function redact(value) {
  return JSON.parse(JSON.stringify(value, (key, nested) => {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("token")
      || normalizedKey === "authorization"
      || normalizedKey === "uploadurl"
      || normalizedKey === "downloadurl"
      || normalizedKey === "signedurl"
      || normalizedKey === "presignedurl"
    ) {
      return "[redacted]";
    }
    if (typeof nested === "string") return redactString(nested);
    return nested;
  }));
}

function redactString(value) {
  return value
    .replaceAll(/https?:\/\/[^\s"')<>]+X-Amz-[^\s"')<>]+/g, "[redacted-presigned-url]")
    .replaceAll(/https?:\/\/[^\s"')<>]+[?&](?:token|signature|access_token|auth)=[^\s"')<>]+/gi, "[redacted-signed-url]")
    .replaceAll(/(Authorization:\s*)(?:Bearer\s+)?[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]")
    .replaceAll(/(X-Amz-(?:Credential|Signature)=)[^&\s"')<>]+/g, "$1[redacted]");
}

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function fail(id, error) {
  process.stdout.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code: -32000, message: error?.message ?? String(error) },
  })}\n`);
}

async function handle(message) {
  if (!message || typeof message !== "object") return;
  const { id, method, params } = message;
  if (id === undefined && method?.startsWith("notifications/")) return;
  try {
    if (method === "initialize") {
      reply(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "alpha-research", version: "0.1.0" },
      });
      return;
    }
    if (method === "tools/list") {
      reply(id, { tools: toolSchemas });
      return;
    }
    if (method === "tools/call") {
      const output = await runTool(params?.name, params?.arguments ?? {});
      reply(id, {
        content: [{ type: "text", text: JSON.stringify(redact(output), null, 2) }],
      });
      return;
    }
    reply(id, {});
  } catch (error) {
    fail(id, error);
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    try {
      void handle(JSON.parse(line));
    } catch (error) {
      fail(null, error);
    }
  }
});
