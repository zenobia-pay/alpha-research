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
const requiredEvidence = [
  "manifest",
  "row count",
  "missingness",
  "join",
  "source URL",
  "county",
  "month",
  "label",
  "chart",
  "artifact",
];

const prompt = [
  "Make me an econ dataset with all necessary econ datasets for a housing-cycle hypothesis.",
  "Use this required source catalog:",
  requiredSources.map((source) => `${source.name}: ${source.url}`).join("; "),
  "Download the needed datasets, normalize them into a research environment, validate coverage, row counts, missingness, join keys, and source URLs.",
  "Then create the analysis subset, write and run the transformation script, run any necessary labeling, choose the visualization artifacts, test the hypothesis, wait until complete, and show me the results and artifacts.",
].join(" ");

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
  return JSON.parse(raw) as SessionRecord;
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

function runCli(sessionDir: string) {
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
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error([
        `Live product E2E timed out after ${timeoutMs}ms.`,
        "The real CLI/backend workflow did not complete inside the test budget.",
        "Partial STDOUT:",
        stdout || "<empty>",
        "Partial STDERR:",
        stderr || "<empty>",
      ].join("\n")));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`research CLI exited ${code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`));
    });
  });
}

function extractRunIds(text: string) {
  const matches = text.matchAll(/\brun[-_][A-Za-z0-9][A-Za-z0-9_-]*/gu);
  return [...new Set([...matches].map((match) => match[0]))];
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

  const startedAt = Date.now();
  console.log([
    "Starting live slow econ product E2E.",
    `Origin: ${session.origin}`,
    `Session dir: ${sessionDir}`,
    `Timeout: ${Number(process.env.RESEARCH_PRODUCT_E2E_TIMEOUT_MS ?? String(90 * 60 * 1000))}ms`,
  ].join("\n"));
  const { stdout, stderr } = await runCli(sessionDir);
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
  for (const source of requiredSources) {
    assertEvidenceContains(evidence, source.name);
    assertEvidenceContains(evidence, source.url);
  }
  for (const needle of requiredEvidence) {
    assertEvidenceContains(evidence, needle);
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log([
    `Live econ product E2E passed in ${elapsedSeconds}s.`,
    `Runs inspected: ${results.map((result) => `${result.run.id}:${result.run.status}`).join(", ")}`,
    `Artifacts inspected: ${results.flatMap((result) => result.artifacts).length}`,
  ].join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
