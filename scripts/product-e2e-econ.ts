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

type DatasetSummary = {
  id: string;
  name: string;
  status?: string;
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

const requiredSources = [
  { name: "Federal Reserve / FRED", url: "https://fred.stlouisfed.org/" },
  { name: "U.S. Census Bureau", url: "https://www.census.gov/data.html" },
  { name: "Zillow", url: "https://www.zillow.com/research/data/" },
  { name: "National Association of Realtors", url: "https://www.nar.realtor/research-and-statistics" },
  { name: "Fannie Mae", url: "https://www.fanniemae.com/research-and-insights/surveys" },
  { name: "BLS", url: "https://www.bls.gov/data/" },
  { name: "Consumer Price Index", url: "https://www.bls.gov/cpi/" },
  { name: "Case-Shiller Index", url: "https://www.spglobal.com/spdji/en/index-family/corelogic-sp-case-shiller/" },
  { name: "NBER", url: "https://www.nber.org/" },
  { name: "Freddie Mac", url: "https://mf.freddiemac.com/aimi" },
  { name: "Redfin", url: "https://www.redfin.com/news/data-center/" },
  { name: "IMF", url: "https://www.imf.org/en/Data" },
  { name: "Federal Reserve Bank of New York", url: "https://www.newyorkfed.org/data-and-statistics" },
  { name: "Apartment List", url: "https://www.apartmentlist.com/research/category/data-rent-estimates" },
  { name: "Pew Research Center", url: "https://www.pewresearch.org/" },
  { name: "American Community Survey", url: "https://www.census.gov/programs-surveys/acs/data.html" },
  { name: "CoreLogic", url: "https://www.corelogic.com/intelligence/us-home-price-insights/" },
  { name: "FHFA Home Price Index", url: "https://www.fhfa.gov/data/hpi" },
  { name: "American Time Use Survey", url: "https://www.bls.gov/tus/" },
  { name: "Current Population Survey", url: "https://www.census.gov/programs-surveys/cps.html" },
  { name: "Senior Loan Officer Opinion Survey", url: "https://www.federalreserve.gov/data/sloos.htm" },
  { name: "ONS", url: "https://www.ons.gov.uk/" },
  { name: "Personal Consumption Expenditures", url: "https://www.bea.gov/data/consumer-spending/main" },
  { name: "American Housing Survey", url: "https://www.census.gov/programs-surveys/ahs.html" },
  { name: "BEA", url: "https://www.bea.gov/data" },
  { name: "Consumer Expenditure Survey", url: "https://www.bls.gov/cex/" },
  { name: "General Social Survey", url: "https://gss.norc.org/" },
  { name: "Panel Study of Income Dynamics", url: "https://psidonline.isr.umich.edu/" },
  { name: "Zillow Home Value Index", url: "https://www.zillow.com/research/data/" },
  { name: "Architecture Billings Index", url: "https://www.aia.org/aia-architecture-billings-index" },
  { name: "Consumer Credit Panel", url: "https://www.newyorkfed.org/data-and-statistics/data-visualization/household-credit-and-debt" },
  { name: "Current Employment Statistics", url: "https://www.bls.gov/ces/" },
  { name: "Gallup", url: "https://news.gallup.com/" },
  { name: "IRS Statistics", url: "https://www.irs.gov/statistics" },
  { name: "Job Openings and Labor Turnover Survey", url: "https://www.bls.gov/jlt/" },
  { name: "Local Area Unemployment Statistics", url: "https://www.bls.gov/lau/" },
  { name: "OECD", url: "https://www.oecd.org/en/data/indicators/housing-prices.html" },
  { name: "Our World in Data", url: "https://ourworldindata.org/" },
  { name: "Pulsenomics Home Price Expectations Survey", url: "https://pulsenomics.com/surveys/" },
  { name: "Wells Fargo / NAHB Housing Market Index", url: "https://www.nahb.org/news-and-economics/housing-economics/indices/housing-market-index" },
  { name: "World Happiness Report", url: "https://worldhappiness.report/data/" },
  { name: "Zillow Observed Rent Index", url: "https://www.zillow.com/research/data/" },
];
const requiredEnvironmentEvidence = [
  "manifest",
  "row count",
  "missingness",
  "join",
  "source URL",
  "county",
  "month",
  "artifact",
];
const requiredHypothesisEvidence = [
  ...requiredEnvironmentEvidence,
  "label",
  "chart",
  "hypothesis",
];

const mode = process.env.RESEARCH_PRODUCT_E2E_ECON_MODE === "hypothesis" ? "hypothesis" : "environment";
const canonicalDatasetId = "econ";

const environmentPrompt = [
  "Create the canonical economics research environment.",
  `The dataset id must be ${canonicalDatasetId}; datasets are named after fields of humanities, and this field is economics.`,
  "Set it up from scratch as an economics dataset with all necessary econ datasets for a housing-cycle hypothesis.",
  `Use every source in this required source catalog: ${requiredSources.map((source) => source.name).join(", ")}.`,
  "Discover and record each exact source URL in the dataset source registry and final artifacts.",
  "Download the needed datasets, normalize them into a research environment, validate coverage, row counts, missingness, join keys, and source URLs.",
  "Produce source_registry.csv, table_catalog.json, normalized tables, crosswalks, a DuckDB catalog, a dataset README, and a QA report.",
  "Wait until the environment build completes, then show me the results and artifacts.",
].join(" ");

const hypothesisPrompt = [
  `Use the existing canonical economics research environment ${canonicalDatasetId}.`,
  "Test this housing-cycle hypothesis: rising mortgage rates reduce housing permits most in counties with weaker income growth.",
  "First inspect whether the necessary data exists in the environment.",
  "Then create the analysis subset, write and run the transformation script, run any necessary labeling, choose the visualization artifacts, test the hypothesis, wait until complete, and show me the results and artifacts.",
].join(" ");

const prompt = mode === "environment" ? environmentPrompt : hypothesisPrompt;

function requireLiveOptIn() {
  if (process.env.RESEARCH_PRODUCT_E2E_LIVE !== "1") {
    throw new Error(
      "Refusing to run live product E2E without RESEARCH_PRODUCT_E2E_LIVE=1. "
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

async function requestWithMethod<T>(session: SessionRecord, path: string, method: string): Promise<T> {
  const response = await fetch(`${session.origin}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Remote request failed ${response.status} for ${method} ${path}: ${body}`);
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

function isPriorEconAttempt(dataset: DatasetSummary) {
  const text = `${dataset.id} ${dataset.name}`.toLowerCase();
  return /\becon\b|economics|housing[-_]cycle|housing cycle/u.test(text);
}

async function deletePriorEconAttempts(session: SessionRecord) {
  const payload = await request<{ datasets: DatasetSummary[] }>(session, "/api/cli/datasets");
  const targets = payload.datasets.filter(isPriorEconAttempt);
  if (targets.length === 0) {
    console.log("No prior econ environment attempts to delete.");
    return;
  }
  console.log(`Deleting ${targets.length} prior econ environment attempt${targets.length === 1 ? "" : "s"} before fresh environment test.`);
  for (const dataset of targets) {
    const runs = await request<{ runs: RunSummary[] }>(session, `/api/cli/runs?datasetId=${encodeURIComponent(dataset.id)}`)
      .catch(() => ({ runs: [] }));
    for (const run of runs.runs) {
      if (!["ready", "completed", "succeeded", "failed", "error", "cancelled", "canceled"].includes(run.status.toLowerCase())) {
        await cancelRun(session, run.id);
        await waitForTerminalRun(session, run.id, 2 * 60 * 1000);
      }
    }
    await requestWithMethod(session, `/api/cli/datasets/${encodeURIComponent(dataset.id)}`, "DELETE");
    console.log(`Deleted prior econ dataset ${dataset.id}.`);
  }
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
          "Live econ product E2E could not start because a dataset is already busy.",
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
        `Live product E2E timed out after ${timeoutMs}ms.`,
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
  assert.ok(evidence.includes(needle.toLowerCase()), `Expected live E2E evidence to include ${needle}`);
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
  assert.ok(artifacts.length > 0, "Expected live product workflow to produce artifacts.");
  assert.ok(
    artifacts.some((artifact) => /manifest|coverage|validation|report|chart|table|result/iu.test(`${artifact.type} ${artifact.title}`)),
    `Expected manifest/coverage/validation/report/chart/table/result artifacts. Saw: ${artifacts.map((artifact) => `${artifact.type}:${artifact.title}`).join(", ")}`,
  );
}

async function main() {
  requireLiveOptIn();
  const sessionDir = process.env.RESEARCH_SESSION_DIR ?? join(".tmp", "research-product-e2e-live");
  const session = await readSession(sessionDir);
  if (mode === "environment") {
    await deletePriorEconAttempts(session);
  }

  const startedAt = Date.now();
  console.log([
    `Starting live slow econ ${mode} product E2E.`,
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
      console.log("Retrying live econ product E2E after transient startup failure.");
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
  if (mode === "environment") {
    for (const source of requiredSources) {
      assertEvidenceContains(evidence, source.name);
      assertEvidenceContains(evidence, source.url);
    }
  }
  const requiredEvidence = mode === "environment" ? requiredEnvironmentEvidence : requiredHypothesisEvidence;
  for (const needle of requiredEvidence) {
    assertEvidenceContains(evidence, needle);
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log([
    `Live econ ${mode} product E2E passed in ${elapsedSeconds}s.`,
    `Runs inspected: ${results.map((result) => `${result.run.id}:${result.run.status}`).join(", ")}`,
    `Artifacts inspected: ${results.flatMap((result) => result.artifacts).length}`,
  ].join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
