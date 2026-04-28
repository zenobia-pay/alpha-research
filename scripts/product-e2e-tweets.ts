import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

type SessionRecord = {
  origin: string;
  accessToken: string;
  createdAt: string;
};

type RunSummary = {
  id: string;
  datasetId: string;
  status: string;
  prompt?: string;
};

type RunResults = {
  run: RunSummary;
  metadata?: { artifactSpec?: unknown } | null;
  events: Array<{ id: string; runId: string; message: string }>;
  artifacts: Array<{ id: string; runId: string; type: string; title: string; content?: unknown }>;
};

class BusyDatasetError extends Error {
  constructor(message: string, readonly runId: string | null) {
    super(message);
    this.name = "BusyDatasetError";
  }
}

class RetryableCliStartupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableCliStartupError";
  }
}

const requiredEvidence = [
  "enriched-tweets",
  "quote_tweet_count",
  "top 0.1%",
  "100",
  "random",
  "label",
  "hook_type",
  "emotional_tone",
  "controversy_level",
  "strict json",
  "bar chart",
  "representative examples",
  "artifact",
];

const prompt = [
  "what's up with tweets? Can you run an experiment for me on what types of tweets go viral?",
  "This is the live slow E2E, so first do the proper planning and state the precise design.",
  "Use the enriched-tweets dataset.",
  "For this test, treat the following design as approved and then actually run it end to end on DigitalOcean:",
  "Define viral as tweets in the top 0.1% by quote_tweet_count.",
  "Pick 100 random viral tweets from that top 0.1%, stratified by month if timestamps are available.",
  "Run LLM labeling on each sampled tweet.",
  "Extract strict JSON fields: hook_type, topic, emotional_tone, controversy_level, novelty, specificity, media_or_link_presence, named_entities, audience_target, call_to_action, quote_tweet_reason, concise_rationale.",
  "Produce visualizations: bar chart of hook_type frequency, stacked bars for emotional_tone by controversy_level, and a table of representative examples with labels and quote counts.",
  "Wait until the remote run succeeds, then show the results and artifacts.",
].join(" ");

function requireLiveOptIn() {
  if (process.env.RESEARCH_PRODUCT_E2E_LIVE !== "1") {
    throw new Error(
      "Refusing to run live tweet product E2E without RESEARCH_PRODUCT_E2E_LIVE=1. "
      + "This test calls the real Alpha Research backend and may provision cloud resources.",
    );
  }
}

async function readSession(sessionDir: string): Promise<SessionRecord> {
  const token = process.env.RESEARCH_E2E_TOKEN;
  const origin = process.env.ALPHA_RESEARCH_WEB_ORIGIN ?? "https://alpharesearch.nyc";
  const sessionPath = join(sessionDir, "session.json");
  if (token) {
    await mkdir(sessionDir, { recursive: true });
    const session = { origin, accessToken: token, createdAt: new Date().toISOString() };
    await writeFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
    return session;
  }
  const fallbackPath = join(homedir(), ".research", "session.json");
  const raw = await readFile(process.env.RESEARCH_SESSION_DIR ? sessionPath : fallbackPath, "utf8")
    .catch(() => {
      throw new Error(
        "No live RESEARCH session found. Run `research login` first or set RESEARCH_E2E_TOKEN.",
      );
    });
  const session = JSON.parse(raw) as SessionRecord;
  await mkdir(sessionDir, { recursive: true });
  await writeFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  return session;
}

async function request<T>(session: SessionRecord, path: string): Promise<T> {
  const response = await fetch(`${session.origin}${path}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Remote request failed ${response.status} for ${path}: ${body}`);
  }
  return response.json() as Promise<T>;
}

async function cancelRun(session: SessionRecord, runId: string) {
  await fetch(`${session.origin}/api/cli/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
  }).catch(() => null);
}

async function waitForTerminalRun(session: SessionRecord, runId: string, timeoutMs: number) {
  const terminalStatuses = new Set(["ready", "completed", "succeeded", "failed", "error", "cancelled", "canceled"]);
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const payload = await request<{ run: RunSummary }>(session, `/api/cli/runs/${encodeURIComponent(runId)}`)
      .catch(() => null);
    const status = payload?.run.status.toLowerCase();
    if (status && terminalStatuses.has(status)) {
      return payload?.run;
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  return null;
}

function runCli(sessionDir: string, session: SessionRecord) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const timeoutMs = Number(process.env.RESEARCH_PRODUCT_E2E_TIMEOUT_MS ?? String(90 * 60 * 1000));
    const child = spawn(process.execPath, ["apps/cli/dist/index.js", "--prompt", prompt], {
      env: {
        ...process.env,
        RESEARCH_SESSION_DIR: sessionDir,
        RESEARCH_DISABLE_RUN_WATCHER: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      child.kill("SIGTERM");
      reject(error);
    };
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (stdout.includes("Dataset is already busy")) {
        const runId = extractBusyRunId(stdout);
        fail(new BusyDatasetError([
          "Live tweet product E2E could not start because the dataset is already busy.",
          "Partial STDOUT:",
          stdout,
          "Partial STDERR:",
          stderr || "<empty>",
        ].join("\n"), runId));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    timeout = setTimeout(() => {
      for (const runId of extractRunIds(stdout)) {
        void cancelRun(session, runId);
      }
      fail(new Error([
        `Live tweet product E2E timed out after ${timeoutMs}ms.`,
        "The real CLI/backend workflow did not complete inside the test budget.",
        "Partial STDOUT:",
        stdout || "<empty>",
        "Partial STDERR:",
        stderr || "<empty>",
      ].join("\n")));
    }, timeoutMs);
    child.on("error", (error) => {
      fail(error);
    });
    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const message = `research CLI exited ${code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
      if (isRetryableCliStartupFailure(stdout, stderr)) {
        reject(new RetryableCliStartupError(message));
        return;
      }
      reject(new Error(message));
    });
  });
}

function isRetryableCliStartupFailure(stdout: string, stderr: string) {
  const combined = `${stdout}\n${stderr}`;
  return extractRunIds(combined).length === 0
    && /fetch failed|UND_ERR_SOCKET|ECONNRESET|ETIMEDOUT|EAI_AGAIN|other side closed/iu.test(combined);
}

function extractBusyRunId(text: string) {
  return text.match(/\bbusy with run\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/iu)?.[1]
    ?? text.match(/\bblocking run\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/iu)?.[1]
    ?? text.match(/\brun\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/iu)?.[1]
    ?? null;
}

function extractRunIds(text: string) {
  const explicitIds = [...text.matchAll(/\brun[-_][A-Za-z0-9][A-Za-z0-9_-]*/gu)].map((match) => match[0]);
  const labelledUuidIds = [...text.matchAll(/\brun\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/giu)]
    .map((match) => match[1]);
  return [...new Set([...explicitIds, ...labelledUuidIds])];
}

function stringifyEvidence(value: unknown) {
  return JSON.stringify(value, null, 2).toLowerCase();
}

function assertEvidenceContains(evidence: string, needle: string) {
  assert.ok(evidence.includes(needle.toLowerCase()), `Expected live tweet E2E evidence to include ${needle}`);
}

function assertTerminalSuccess(results: RunResults[]) {
  const terminalStatuses = new Set(["ready", "completed", "succeeded"]);
  assert.ok(
    results.some((result) => terminalStatuses.has(result.run.status.toLowerCase())),
    `Expected at least one successful terminal run. Saw: ${results.map((result) => `${result.run.id}:${result.run.status}`).join(", ")}`,
  );
}

function assertProducedArtifacts(results: RunResults[]) {
  const artifacts = results.flatMap((result) => result.artifacts);
  assert.ok(artifacts.length > 0, "Expected live tweet workflow to produce artifacts.");
  assert.ok(
    artifacts.some((artifact) => /label|chart|table|result|report|summary/iu.test(`${artifact.type} ${artifact.title}`)),
    `Expected label/chart/table/result/report artifacts. Saw: ${artifacts.map((artifact) => `${artifact.type}:${artifact.title}`).join(", ")}`,
  );
}

async function main() {
  requireLiveOptIn();
  const sessionDir = process.env.RESEARCH_SESSION_DIR ?? join(".tmp", "research-product-e2e-tweets-live");
  const session = await readSession(sessionDir);

  const startedAt = Date.now();
  console.log([
    "Starting live slow tweets product E2E.",
    `Origin: ${session.origin}`,
    `Session dir: ${sessionDir}`,
    `Timeout: ${Number(process.env.RESEARCH_PRODUCT_E2E_TIMEOUT_MS ?? String(90 * 60 * 1000))}ms`,
  ].join("\n"));
  let stdout = "";
  let stderr = "";
  const retryUntil = Date.now() + Number(process.env.RESEARCH_PRODUCT_E2E_BUSY_RETRY_MS ?? String(20 * 60 * 1000));
  for (;;) {
    try {
      const output = await runCli(sessionDir, session);
      stdout = output.stdout;
      stderr = output.stderr;
      break;
    } catch (error) {
      if (!(error instanceof BusyDatasetError) && !(error instanceof RetryableCliStartupError)) {
        throw error;
      }
      if (Date.now() >= retryUntil) {
        throw error;
      }
      console.log(error.message);
      if (error instanceof BusyDatasetError && error.runId) {
        console.log(`Waiting for blocking run ${error.runId} to become terminal before retrying.`);
        await waitForTerminalRun(session, error.runId, 5 * 60 * 1000);
      }
      await new Promise((resolve) => setTimeout(resolve, 30_000));
      console.log("Retrying live tweets product E2E after transient startup failure.");
    }
  }
  const runIds = extractRunIds(`${stdout}\n${stderr}`);
  assert.ok(runIds.length > 0, `Expected CLI output to include at least one run id.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);

  const results: RunResults[] = [];
  for (const runId of runIds) {
    const result = await request<RunResults>(session, `/api/cli/runs/${encodeURIComponent(runId)}/results`)
      .catch(() => null);
    if (result) {
      results.push(result);
    }
  }

  assert.ok(results.length > 0, `Expected remote result bundles for run ids: ${runIds.join(", ")}`);
  assertTerminalSuccess(results);
  assertProducedArtifacts(results);

  const evidence = stringifyEvidence({
    prompt,
    stdout,
    stderr,
    results,
  });
  for (const needle of requiredEvidence) {
    assertEvidenceContains(evidence, needle);
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log([
    `Live tweets product E2E passed in ${elapsedSeconds}s.`,
    `Runs inspected: ${results.map((result) => `${result.run.id}:${result.run.status}`).join(", ")}`,
    `Artifacts inspected: ${results.flatMap((result) => result.artifacts).length}`,
  ].join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
