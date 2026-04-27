import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultAgentRuntimeDeps,
  runAgentTurn,
  type AgentMessage,
  type AgentRuntimeDeps,
} from "../src/agent.js";
import type { SessionRecord } from "../src/config.js";
import { buildRunDebugBundle } from "../src/debug.js";
import { RemoteRequestError } from "../src/remote.js";

const session = {
  origin: "https://alpharesearch.nyc",
  accessToken: "test-token",
  createdAt: "2026-04-22T00:00:00.000Z",
} satisfies SessionRecord;

function collect() {
  const messages: AgentMessage[] = [];
  return {
    messages,
    emit(message: AgentMessage) {
      messages.push(message);
    },
  };
}

test("unauthenticated local run request bypasses remote planning", async () => {
  const { messages, emit } = collect();
  await runAgentTurn("show active runs", null, emit);
  assert.equal(messages[0]?.content, "Running list_tracked_runs");
  assert.equal(messages.at(-1)?.role, "assistant");
});

test("async query run returns immediately with canonical dashboard and terminal links", async () => {
  const calls: string[] = [];
  const fakeClient = {
    async respond() {
      calls.push("respond");
      return {
        sessionId: "terminal-session-1",
        payload: {
          id: "response-1",
          output: [{
            type: "function_call",
            call_id: "call-1",
            name: "query_remote_dataset",
            arguments: JSON.stringify({
              datasetId: "enriched-tweets",
              prompt: "Return 10 viral tweets.",
            }),
          }],
        },
      };
    },
    async startRun() {
      calls.push("startRun");
      return {
        run: {
          id: "run-123",
          datasetId: "enriched-tweets",
          status: "booting",
          prompt: "Return 10 viral tweets.",
          createdAt: "2026-04-22T00:00:00.000Z",
          updatedAt: "2026-04-22T00:00:00.000Z",
        },
      };
    },
    async appendSessionEntry() {
      calls.push("appendSessionEntry");
      return { id: "entry-1" };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn("get me 10 viral tweets", session, emit, undefined, deps);

  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /Started query run run-123/);
  assert.match(final, /https:\/\/dashboard\.alpharesearch\.nyc\/\?view=runs&runId=run-123#run-run-123/);
  assert.match(final, /Terminal session: https:\/\/dashboard\.alpharesearch\.nyc\/\?view=terminal-sessions&sessionId=terminal-session-1&runId=run-123#run-run-123/);
  assert.equal(calls.includes("startRun"), true);
});

test("run result retrieval includes original prompt and artifacts", async () => {
  const fakeClient = {
    async respond(body: Record<string, unknown>) {
      if (Array.isArray(body.input)) {
        return {
          sessionId: "terminal-session-2",
          payload: {
            id: "response-2",
            output_text: "Here are the results.",
            output: [{ type: "message", content: [{ type: "output_text", text: "Here are the results." }] }],
          },
        };
      }
      return {
        sessionId: "terminal-session-2",
        payload: {
          id: "response-1",
          output: [{
            type: "function_call",
            call_id: "call-1",
            name: "get_run_results",
            arguments: JSON.stringify({ runId: "run-456" }),
          }],
        },
      };
    },
    async getRunResults() {
      return {
        run: {
          id: "run-456",
          datasetId: "enriched-tweets",
          status: "ready",
          prompt: "Quick sanity check.",
        },
        metadata: { artifactSpec: [{ type: "json", title: "Result JSON" }] },
        events: [{ id: "evt-1", runId: "run-456", message: "Run completed." }],
        artifacts: [{
          id: "artifact-1",
          runId: "run-456",
          type: "structured_result",
          title: "result.json",
          content: {
            total_rows: 100,
            distinct_tweet_ids: 99,
            duplicate_tweet_rows: 1,
            top_usernames: [{ username: "example", row_count: 10 }],
          },
        }],
      };
    },
    async appendSessionEntry() {
      return { id: "entry-1" };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn("what was my last result?", session, emit, undefined, deps);

  const toolOutput = messages.find((message) => message.role === "tool" && message.content.includes("Original request"))?.content ?? "";
  assert.match(toolOutput, /Quick sanity check\./);
  assert.match(toolOutput, /Artifacts are the saved outputs from the run/);
  assert.match(toolOutput, /Suggested follow-ups/);
});

test("busy dataset conflict returns blocking run guidance", async () => {
  const fakeClient = {
    async respond(body: Record<string, unknown>) {
      if (Array.isArray(body.input)) {
        return {
          sessionId: "terminal-session-3",
          payload: {
            id: "response-2",
            output_text: "Done.",
            output: [{ type: "message", content: [{ type: "output_text", text: "Done." }] }],
          },
        };
      }
      return {
        sessionId: "terminal-session-3",
        payload: {
          id: "response-1",
          output: [{
            type: "function_call",
            call_id: "call-1",
            name: "query_remote_dataset",
            arguments: JSON.stringify({ datasetId: "busy-dataset", prompt: "Run analysis." }),
          }],
        },
      };
    },
    async startRun() {
      throw new RemoteRequestError(
        'Remote request failed (409) for /api/cli/datasets/busy-dataset/runs. {"error":"dataset has an active run holding its volume","activeRuns":[{"id":"run-blocking","status":"running"}]}',
        409,
        "/api/cli/datasets/busy-dataset/runs",
      );
    },
    async appendSessionEntry() {
      return { id: "entry-1" };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn("run analysis on busy dataset", session, emit, undefined, deps);

  const joined = messages.map((message) => message.content).join("\n");
  assert.match(joined, /Dataset is already busy with run run-blocking/);
  assert.match(joined, /https:\/\/dashboard\.alpharesearch\.nyc\/\?view=runs&runId=run-blocking#run-run-blocking/);
});

test("wait for run completion can time out deterministically", async () => {
  const fakeClient = {
    async respond(body: Record<string, unknown>) {
      if (Array.isArray(body.input)) {
        return {
          sessionId: "terminal-session-4",
          payload: {
            id: "response-2",
            output_text: "Still running.",
            output: [{ type: "message", content: [{ type: "output_text", text: "Still running." }] }],
          },
        };
      }
      return {
        sessionId: "terminal-session-4",
        payload: {
          id: "response-1",
          output: [{
            type: "function_call",
            call_id: "call-1",
            name: "wait_for_run_completion",
            arguments: JSON.stringify({ runId: "run-slow", timeoutSeconds: 0 }),
          }],
        },
      };
    },
    async getRun() {
      return { run: { id: "run-slow", datasetId: "dataset", status: "running" } };
    },
    async getRunEvents() {
      return { events: [] };
    },
    async getRunResults() {
      return {
        run: { id: "run-slow", datasetId: "dataset", status: "running" },
        metadata: null,
        events: [],
        artifacts: [],
      };
    },
    async appendSessionEntry() {
      return { id: "entry-1" };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn("wait for run-slow until complete", session, emit, undefined, deps);

  assert.match(messages.map((message) => message.content).join("\n"), /Run run-slow is still running/);
});

test("run debug bundle redacts session token and includes remote evidence", async () => {
  const bundle = await buildRunDebugBundle("run-debug-1", {
    readSession: async () => ({
      origin: "https://alpharesearch.nyc",
      accessToken: "test-token-secret",
      createdAt: "2026-04-22T00:00:00.000Z",
    }),
    createRemoteClient: () => ({
      async getRun() {
        return { run: { id: "run-debug-1", datasetId: "dataset", status: "failed" } };
      },
      async getRunResults() {
        return {
          run: { id: "run-debug-1", datasetId: "dataset", status: "failed" },
          metadata: { artifactSpec: [] },
          events: [{ id: "evt-1", runId: "run-debug-1", message: "Failed." }],
          artifacts: [],
        };
      },
      async getRunEvents() {
        return { events: [{ id: "evt-1", runId: "run-debug-1", message: "Failed." }] };
      },
      async getRunArtifacts() {
        return { artifacts: [] };
      },
    }),
    readTrackedRuns: async () => [{
      id: "run-debug-1",
      datasetId: "dataset",
      origin: "https://alpharesearch.nyc",
      status: "failed",
      createdAt: "2026-04-22T00:00:00.000Z",
      updatedAt: "2026-04-22T00:00:00.000Z",
      lastSeenAt: "2026-04-22T00:00:00.000Z",
    }],
    now: () => new Date("2026-04-22T12:00:00.000Z"),
  });

  assert.equal(bundle.generatedAt, "2026-04-22T12:00:00.000Z");
  assert.equal(bundle.session?.accessTokenPreview, "test-tok...redacted");
  assert.equal(JSON.stringify(bundle).includes("test-token-secret"), false);
  assert.match(bundle.dashboardUrl, /run-debug-1/);
  assert.deepEqual(bundle.remote.events, { events: [{ id: "evt-1", runId: "run-debug-1", message: "Failed." }] });
});

test("product workflow success: econ research hypothesis creates data environment, specs, scripts, labels, and artifacts", async () => {
  const calls: Array<{ name: string; body?: unknown; prompt?: string; options?: unknown }> = [];
  const requiredPublicSources = [
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
  const responses = [
    {
      name: "list_remote_datasets",
      arguments: {},
    },
    {
      name: "create_research_environment",
      arguments: {
        datasetId: "econ-housing-cycle",
        name: "Economics Housing Cycle Research Environment",
        description: "Housing and macroeconomic data for testing regional affordability and credit-cycle hypotheses.",
        sourceDescription: "Public macro, housing, mortgage, credit, labor, inflation, and demographic data.",
        publicSources: requiredPublicSources.map((source) => ({ ...source, kind: "public-data-source" })),
        prompt: [
          "Build the econ housing-cycle research environment.",
          `Fetch and stage this required source catalog: ${requiredPublicSources.map((source) => `${source.name}: ${source.url}`).join("; ")}.`,
          "Use monthly or quarterly observations from 2000 onward where available.",
          "Normalize source tables into a manifest-backed dataset with date, geography, source, series_id, value, unit, and vintage fields.",
          "Create derived county/state/month panels for affordability, labor markets, rates, prices, income, permits, and mortgage indicators.",
          "Validate coverage, row counts, missingness, join keys, source URLs, and reproducible fetch scripts.",
        ].join(" "),
        artifacts: [
          { type: "manifest", title: "Normalized dataset manifest" },
          { type: "coverage_report", title: "Source coverage and validation report" },
        ],
      },
    },
    {
      name: "wait_for_run_completion",
      arguments: { runId: "run-env", timeoutSeconds: 0 },
    },
    {
      name: "create_research_spec",
      arguments: {
        datasetId: "econ-housing-cycle",
        hypothesis: "Rising mortgage rates reduce housing permits most in counties with weaker income growth.",
        spec: {
          subset: {
            geography: "county",
            frequency: "monthly",
            startDate: "2000-01-01",
            requiredFields: [
              "mortgage_rate_30y",
              "housing_permits",
              "median_household_income",
              "unemployment_rate",
              "house_price_index",
            ],
          },
          shaping: {
            panel: "county_month",
            joins: ["date", "county_fips"],
            transforms: ["rate deltas", "income growth", "permit growth", "lagged controls"],
          },
          labeling: {
            required: true,
            outputField: "market_regime_label",
            prompt: "Label each county-month as expansion, slowdown, or stress using rates, unemployment, permits, and HPI movement.",
          },
          artifacts: [
            { type: "table", title: "County-month regression-ready panel" },
            { type: "chart", title: "Permit sensitivity by income-growth quartile", chart: "line", x: "month", y: "permit_growth" },
            { type: "chart", title: "Rate shock response by market regime", chart: "bar", x: "market_regime_label", y: "permit_response" },
          ],
        },
        status: "ready",
      },
    },
    {
      name: "run_remote_transformation",
      arguments: {
        datasetId: "econ-housing-cycle",
        prompt: "Create the county-month analysis panel for the housing-rate hypothesis.",
        scriptOutline: "Join FRED mortgage rates, FHFA HPI, Census permits/income, BLS unemployment, and BEA income by county_fips/month; compute lags, deltas, quartiles, and missingness flags.",
      },
    },
    {
      name: "wait_for_run_completion",
      arguments: { runId: "run-transform", timeoutSeconds: 0 },
    },
    {
      name: "run_remote_labeling",
      arguments: {
        datasetId: "econ-housing-cycle",
        prompt: "Label market regimes on the county-month panel.",
        labelingPrompt: "For each county-month, assign expansion, slowdown, or stress using mortgage-rate changes, unemployment trend, HPI trend, permit growth, and income growth. Return the label and short rationale.",
      },
    },
    {
      name: "wait_for_run_completion",
      arguments: { runId: "run-label", timeoutSeconds: 0 },
    },
    {
      name: "start_remote_run",
      arguments: {
        datasetId: "econ-housing-cycle",
        prompt: "Test whether rising mortgage rates reduce housing permits most in counties with weaker income growth, using the labeled county-month panel.",
        type: "hypothesis",
        config: {
          hypothesis: "Rising mortgage rates reduce housing permits most in counties with weaker income growth.",
          subset: "county_month_panel_2000_present",
          model: "fixed effects panel regression with lagged controls",
        },
        artifacts: [
          { type: "table", title: "Regression summary" },
          { type: "chart", title: "Permit sensitivity by income-growth quartile", chart: "line", x: "month", y: "permit_growth" },
          { type: "chart", title: "Rate shock response by market regime", chart: "bar", x: "market_regime_label", y: "permit_response" },
          { type: "markdown", title: "Hypothesis report" },
        ],
      },
    },
    {
      name: "wait_for_run_completion",
      arguments: { runId: "run-hypothesis", timeoutSeconds: 0 },
    },
    {
      name: "get_run_results",
      arguments: { runId: "run-hypothesis" },
    },
  ];

  const fakeClient = {
    async respond(body: Record<string, unknown>) {
      if (Array.isArray(body.input)) {
        const next = responses.shift();
        if (!next) {
          return {
            sessionId: "product-session",
            payload: {
              id: "product-final",
              output_text: "The econ research workflow completed with a validated dataset, spec, labels, and hypothesis artifacts.",
              output: [{
                type: "message",
                content: [{
                  type: "output_text",
                  text: "The econ research workflow completed with a validated dataset, spec, labels, and hypothesis artifacts.",
                }],
              }],
            },
          };
        }
        return {
          sessionId: "product-session",
          payload: {
            id: `product-${next.name}`,
            output: [{
              type: "function_call",
              call_id: `call-${next.name}-${responses.length}`,
              name: next.name,
              arguments: JSON.stringify(next.arguments),
            }],
          },
        };
      }
      const first = responses.shift();
      assert.ok(first);
      return {
        sessionId: "product-session",
        payload: {
          id: "product-initial",
          output: [{
            type: "function_call",
            call_id: "call-initial",
            name: first.name,
            arguments: JSON.stringify(first.arguments),
          }],
        },
      };
    },
    async appendSessionEntry() {
      return { id: "entry-1" };
    },
    async listDatasets() {
      calls.push({ name: "listDatasets" });
      return { datasets: [] };
    },
    async createDataset(body: unknown) {
      calls.push({ name: "createDataset", body });
      return { dataset: { id: "econ-housing-cycle", name: "Economics Housing Cycle Research Environment", status: "draft" } };
    },
    async createResearchEnvironment(_datasetId: string, body: unknown) {
      calls.push({ name: "createResearchEnvironment", body });
      return {
        dataset: { id: "econ-housing-cycle", name: "Economics Housing Cycle Research Environment", status: "building" },
        environment: {
          datasetId: "econ-housing-cycle",
          status: "booting",
          manifestPath: "data/instances/econ-housing-cycle/manifest.json",
        },
        run: {
          id: "run-env",
          datasetId: "econ-housing-cycle",
          status: "booting",
          prompt: "Build the econ housing-cycle research environment.",
        },
      };
    },
    async createResearchSpec(body: unknown) {
      calls.push({ name: "createResearchSpec", body });
      return {
        spec: {
          id: "spec-housing-rates",
          datasetId: "econ-housing-cycle",
          hypothesis: "Rising mortgage rates reduce housing permits most in counties with weaker income growth.",
          spec: (body as { spec?: Record<string, unknown> }).spec,
          status: "ready",
        },
      };
    },
    async startRun(datasetId: string, prompt: string, options?: { type?: string }) {
      calls.push({ name: "startRun", prompt, options });
      const idByType: Record<string, string> = {
        transform: "run-transform",
        label: "run-label",
        hypothesis: "run-hypothesis",
      };
      return {
        run: {
          id: idByType[options?.type ?? ""] ?? "run-analysis",
          datasetId,
          status: "running",
          prompt,
        },
      };
    },
    async getRunEvents(runId: string) {
      return { events: [{ id: `evt-${runId}`, runId, message: `${runId} completed.` }] };
    },
    async getRunResults(runId: string) {
      const baseRun = {
        id: runId,
        datasetId: "econ-housing-cycle",
        status: "ready",
        prompt: runId === "run-hypothesis"
          ? "Test whether rising mortgage rates reduce housing permits most in counties with weaker income growth."
          : "Workflow step completed.",
      };
      if (runId === "run-hypothesis") {
        return {
          run: baseRun,
          metadata: {
            artifactSpec: [
              { type: "table", title: "Regression summary" },
              { type: "chart", title: "Permit sensitivity by income-growth quartile" },
              { type: "chart", title: "Rate shock response by market regime" },
              { type: "markdown", title: "Hypothesis report" },
            ],
          },
          events: [{ id: "evt-run-hypothesis", runId, message: "Hypothesis run completed." }],
          artifacts: [
            {
              id: "artifact-result",
              runId,
              type: "structured_result",
              title: "result.json",
              content: {
                total_rows: 312000,
                analysis_panel: "county_month_panel_2000_present",
                finding: "Rate increases have the largest negative permit response in the lowest income-growth quartile.",
                charts: ["Permit sensitivity by income-growth quartile", "Rate shock response by market regime"],
              },
            },
            { id: "artifact-table", runId, type: "table", title: "Regression summary" },
            { id: "artifact-chart-1", runId, type: "chart", title: "Permit sensitivity by income-growth quartile" },
            { id: "artifact-chart-2", runId, type: "chart", title: "Rate shock response by market regime" },
            { id: "artifact-report", runId, type: "markdown", title: "Hypothesis report.md" },
          ],
        };
      }
      return {
        run: baseRun,
        metadata: { artifactSpec: [] },
        events: [{ id: `evt-${runId}`, runId, message: `${runId} completed.` }],
        artifacts: [{ id: `artifact-${runId}`, runId, type: "structured_result", title: "result.json", content: { ok: true } }],
      };
    },
    async getRun(runId: string) {
      return { run: { id: runId, datasetId: "econ-housing-cycle", status: "ready" } };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn(
    "Make me an econ dataset with all necessary econ datasets for a housing-cycle hypothesis, then wait until complete and show me the results and artifacts.",
    session,
    emit,
    undefined,
    deps,
  );

  const callNames = calls.map((call) => call.name);
  assert.deepEqual(callNames, [
    "listDatasets",
    "createDataset",
    "createResearchEnvironment",
    "createResearchSpec",
    "startRun",
    "startRun",
    "startRun",
  ]);
  assert.equal(responses.length, 0);

  const environmentBody = calls.find((call) => call.name === "createResearchEnvironment")?.body as {
    publicSources?: Array<{ name?: string }>;
    prompt?: string;
    artifacts?: Array<{ type?: string; title?: string }>;
  };
  const sourceNames = new Set(environmentBody.publicSources?.map((source) => source.name));
  for (const required of requiredPublicSources) {
    assert.equal(sourceNames.has(required.name), true, `missing required public source ${required.name}`);
    assert.match(environmentBody.prompt ?? "", new RegExp(required.name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    assert.match(environmentBody.prompt ?? "", new RegExp(required.url.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.match(environmentBody.prompt ?? "", /Normalize source tables/i);
  assert.match(environmentBody.prompt ?? "", /Validate coverage, row counts, missingness, join keys, source URLs/i);
  assert.deepEqual(environmentBody.artifacts?.map((artifact) => artifact.type), ["manifest", "coverage_report"]);

  const specBody = calls.find((call) => call.name === "createResearchSpec")?.body as {
    spec?: {
      subset?: { requiredFields?: string[] };
      shaping?: { transforms?: string[] };
      labeling?: { required?: boolean; prompt?: string };
      artifacts?: Array<{ type?: string; title?: string; chart?: string; x?: string; y?: string }>;
    };
  };
  assert.deepEqual(specBody.spec?.subset?.requiredFields, [
    "mortgage_rate_30y",
    "housing_permits",
    "median_household_income",
    "unemployment_rate",
    "house_price_index",
  ]);
  assert.equal(specBody.spec?.labeling?.required, true);
  assert.match(specBody.spec?.labeling?.prompt ?? "", /expansion, slowdown, or stress/i);
  assert.ok(specBody.spec?.artifacts?.some((artifact) =>
    artifact.type === "chart"
    && artifact.title === "Permit sensitivity by income-growth quartile"
    && artifact.x === "month"
    && artifact.y === "permit_growth"
  ));

  const runTypes = calls
    .filter((call) => call.name === "startRun")
    .map((call) => (call.options as { type?: string }).type);
  assert.deepEqual(runTypes, ["transform", "label", "hypothesis"]);

  const joinedMessages = messages.map((message) => message.content).join("\n");
  assert.match(joinedMessages, /Started research environment build run-env/);
  assert.match(joinedMessages, /Created research spec spec-housing-rates/);
  assert.match(joinedMessages, /Queued transformation run run-transform/);
  assert.match(joinedMessages, /Queued labeling run run-label/);
  assert.match(joinedMessages, /Started run run-hypothesis/);
  assert.match(joinedMessages, /Regression summary/);
  assert.match(joinedMessages, /Permit sensitivity by income-growth quartile/);
  assert.match(joinedMessages, /Hypothesis report\.md/);
});
