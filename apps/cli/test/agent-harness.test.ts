import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  createToolRegistry,
  createDefaultAgentRuntimeDeps,
  runAgentTurn,
  type AgentMessage,
  type AgentRuntimeDeps,
} from "../src/agent.js";
import { RUNS_PATH, type SessionRecord } from "../src/config.js";
import { buildRunDebugBundle } from "../src/debug.js";
import { composerPlaceholder } from "../src/interactive.js";
import { RemoteRequestError } from "../src/remote.js";
import { writeTrackedRuns } from "../src/runs.js";

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

test("signed-out remote dataset request explains auth recovery and preserves intent", async () => {
  const { messages, emit } = collect();
  await runAgentTurn("Show my remote datasets.", null, emit);

  assert.equal(messages.length, 1);
  const final = messages[0]?.content ?? "";
  assert.match(final, /Sign in to view your remote datasets\./);
  assert.match(final, /run `\/login` in this chat or `research login` in another terminal/i);
  assert.match(final, /After you sign in, ask me again and I’ll pick up: "Show my remote datasets\."/);
  assert.doesNotMatch(final, /session\.json|token|working|Checking remote datasets|Found \d+ remote datasets/i);
});

test("signed-out composer placeholder is contextual", () => {
  assert.equal(composerPlaceholder(null), "Ask about datasets, runs, or sign-in");
  assert.equal(composerPlaceholder(session), "Ask about datasets, runs, or artifacts");
});

test("product orientation presents command center identities without tools", async () => {
  const fakeClient = {
    async respond() {
      throw new Error("Orientation should be answered locally without remote planning.");
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn("What can you help me do?", session, emit, undefined, deps);

  assert.equal(messages.length, 1);
  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /turn files and datasets into research/i);
  assert.match(final, /Start here:/i);
  assert.match(final, /Show my datasets/i);
  assert.match(final, /research login/i);
  assert.match(final, /Create a dataset from \/absolute\/path\/customers\.csv/i);
  assert.match(final, /inspect what each one contains/i);
  assert.match(final, /Brief a dataset before you trust or analyze it/i);
  assert.match(final, /Plan or run an analysis for a specific question/i);
  assert.match(final, /latest results or saved files from earlier work/i);
  assert.match(final, /Show my latest analysis results/i);
  assert.match(final, /what data do i already have ready to use/i);
  assert.match(final, /brief the econ dataset/i);
  assert.doesNotMatch(final, /dataset-backed|artifacts|labeling jobs|experiments|last run|remote run|manifest-backed|mounted dataset|worker_unreachable|lifecycle|remote environments?|normalize/i);
});

test("cold-start orientation prompt stays local and recommends first steps", async () => {
  const fakeClient = {
    async respond() {
      throw new Error("Cold-start orientation should be answered locally.");
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn(
    "I just opened research. What is this, and what should I type first?",
    session,
    emit,
    undefined,
    deps,
  );

  assert.equal(messages.length, 1);
  const coldStart = messages.at(-1)?.content ?? "";
  assert.match(coldStart, /^RESEARCH helps you turn files and datasets into research/i);
  assert.match(coldStart, /`research login`/i);
  assert.match(coldStart, /so I can see your datasets and start research runs for you/i);
  assert.match(coldStart, /What data do I already have ready to use/i);
  assert.doesNotMatch(coldStart, /datasets ls|local ls|env create|normalize|remote datasets|artifacts/u);
});

test("file import how-to asks for path before ingesting", async () => {
  const fakeClient = {
    async respond() {
      throw new Error("Import how-to should not call remote tools until a file path exists.");
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn(
    "I have a CSV of customer support tickets on my desktop. How do I turn it into something I can research here?",
    session,
    emit,
    undefined,
    deps,
  );

  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /I need 2 things to import your file/i);
  assert.match(final, /absolute file path/i);
  assert.match(final, /one-line description/i);
  assert.match(final, /One line is enough/i);
  assert.match(final, /infer the schema/i);
  assert.match(final, /dataset name\/id/i);
  assert.match(final, /prepare it for research/i);
  assert.match(final, /\/Users\/ryanprendergast\/Desktop\/support_tickets\.csv/i);
  assert.match(final, /copy it from Finder/i);
  assert.doesNotMatch(final, /register the dataset|upload it|deploy it/i);
  assert.doesNotMatch(final, /help narrow it down/i);
  assert.doesNotMatch(final, /Started|run-[a-z0-9-]+|Dashboard:/i);
});

test("journey P02 wording resolves locally without remote planning", async () => {
  const fakeClient = {
    async respond() {
      throw new Error("Missing-path intake should be answered locally without remote planning.");
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn(
    "I have a CSV export of customer support tickets. I want to turn it into a dataset I can research here, but I don't know what you need from me.",
    session,
    emit,
    undefined,
    deps,
  );

  assert.equal(messages.length, 1);
  const final = messages[0]?.content ?? "";
  assert.match(final, /absolute file path/i);
  assert.match(final, /one-line description/i);
  assert.match(final, /What happens next:/i);
  assert.doesNotMatch(final, /RESEARCH turns your data into a dataset/i);
  assert.doesNotMatch(final, /register|upload|deploy/i);
});

test("vague housing risk request asks scope before costly work", async () => {
  const fakeClient = {
    async respond() {
      throw new Error("Vague housing risk questions should not start remote planning before scope is chosen.");
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn("Can you look into whether the housing market is in trouble?", session, emit, undefined, deps);

  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /smallest scope decision/i);
  assert.match(final, /U\.S\. housing market/i);
  assert.match(final, /specific metro\/region/i);
  assert.match(final, /quick current-state read/i);
  assert.match(final, /deeper risk analysis/i);
  assert.match(final, /affordability stress/i);
  assert.match(final, /price decline risk/i);
  assert.match(final, /credit stress/i);
  assert.match(final, /affordability/i);
  assert.match(final, /mortgage rates/i);
  assert.match(final, /price\/rent divergence/i);
  assert.doesNotMatch(final, /Started|Queued|Dashboard:/i);
});

test("dataset inventory is recommendation-first, name-first, and de-emphasizes noisy datasets", async () => {
  const fakeClient = {
    async respond() {
      throw new Error("Dataset inventory should be answered locally from dataset listings.");
    },
    async listDatasets() {
      return {
        datasets: [
          { id: "enriched-tweets", name: "Enriched Tweets", status: "ready", deploymentStatus: "ready" },
          { id: "mixed-smoke-1776979192", name: "Mixed Smoke Test", status: "ready", deploymentStatus: "ready" },
          { id: "econ", name: "Unemployment vs Home Values 2019–2024", status: "provisioning", deploymentStatus: "building" },
          { id: "upload-test-93961", name: "Upload Test", status: "uploaded", deploymentStatus: "uploaded" },
          { id: "dataset", name: "enriched_tweets_parquet_dataset", status: "draft" },
        ],
      };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
    listLocalDatasets: async () => [
      {
        id: "local-county-econ",
        productName: "County Economics",
        datasetId: "county-economics",
        displayName: "County Economics",
        description: "county-level economics for regional trend comparisons",
        recordCount: 4,
        layout: "sharded",
      },
      {
        id: "local-tweets",
        productName: "Tweet Archive",
        datasetId: "tweets",
        displayName: "Tweet Archive",
        description: "tweet archive for social/content analysis",
        recordCount: 3,
        layout: "sharded",
      },
    ],
  };
  const { messages, emit } = collect();

  await runAgentTurn("What data do I already have that is ready to use?", session, emit, undefined, deps);

  assert.equal(messages[0]?.content, "Checking local datasets...");
  assert.equal(messages[2]?.content, "Checking remote datasets...");

  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /^Best starting point: County Economics \(local\)/);
  assert.match(final, /Next step: use locally with dataset id `county-economics`/);
  assert.match(final, /Ready now/);
  assert.match(final, /County Economics \(local\) — county-level economics for regional trend comparisons\./);
  assert.match(final, /Enriched Tweets \(remote\) — tweet archive for social\/content analysis\./);
  assert.match(final, /id: county-economics/);
  assert.match(final, /id: enriched-tweets/);
  assert.match(final, /Other datasets/);
  assert.match(final, /Mixed Smoke Test \(remote\).*query remotely; ready to use; deployed\./);
  assert.match(final, /Unemployment vs Home Values 2019–2024 \(remote\).*not ready yet; still being prepared\./);
  assert.match(final, /Upload Test \(remote\).*uploaded but not queryable yet\./);
  assert.match(final, /enriched_tweets_parquet_dataset \(remote\).*still a draft\./);
});

test("dataset selection from topic uses dataset metadata and asks one focused follow-up", async () => {
  let respondCalled = false;
  const fakeClient = {
    async respond() {
      respondCalled = true;
      throw new Error("Dataset-choice prompts should be handled from lightweight metadata lookup first.");
    },
    async listDatasets() {
      return {
        datasets: [
          { id: "econ", name: "Economics", status: "ready", createdAt: "2026-04-20T00:00:00.000Z" },
          { id: "tweets", name: "Tweets", status: "ready", createdAt: "2026-04-19T00:00:00.000Z" },
          { id: "housing-policy", name: "Housing Policy", status: "ready", createdAt: "2026-04-18T00:00:00.000Z" },
        ],
      };
    },
    async getDataset(datasetId: string) {
      if (datasetId === "econ") {
        return {
          dataset: {
            id: "econ",
            name: "Economics",
            status: "ready",
            profile: {
              sources: ["ACS", "HUD", "Zillow"],
              notes: "County and metro rent, income, and home-value coverage for affordability work.",
            },
          },
        };
      }
      if (datasetId === "housing-policy") {
        return {
          dataset: {
            id: "housing-policy",
            name: "Housing Policy",
            status: "ready",
            profile: {
              sources: ["HUD"],
              notes: "Policy thresholds and local housing-program reference tables.",
            },
          },
        };
      }
      return {
        dataset: {
          id: datasetId,
          name: datasetId,
          status: "ready",
          profile: null,
        },
      };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn("I want to study housing affordability. Which dataset should I use?", session, emit, undefined, deps);

  assert.equal(messages[0]?.role, "tool");
  assert.match(messages[0]?.content ?? "", /Looking up candidate datasets/i);
  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /Primary dataset/i);
  assert.match(final, /`econ`/i);
  assert.match(final, /ACS\/Census coverage|HUD affordability benchmarks|housing market rent\/home value series/i);
  assert.doesNotMatch(final, /Primary dataset[\s\S]*Primary dataset/i);
  assert.match(final, /Need from you/i);
  assert.match(final, /Which geography matters most/i);
  assert.doesNotMatch(final, /reuse one|create one|provision/i);
  assert.equal(respondCalled, false);
});

test("remote planning emits immediate progress before waiting on backend response", async () => {
  const fakeClient = {
    async respond() {
      return {
        sessionId: "terminal-session-progress",
        payload: {
          id: "response-progress",
          output_text: "Use dataset `econ`.",
        },
      };
    },
    async appendSessionEntry() {
      return { id: "entry-progress" };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn("Show my remote datasets.", session, emit, undefined, deps);

  assert.equal(messages[0]?.role, "tool");
  assert.match(messages[0]?.content ?? "", /Checking datasets/i);
  assert.equal(messages.at(-1)?.role, "assistant");
  assert.match(messages.at(-1)?.content ?? "", /Use dataset `econ`\./);
});

test("dataset recommendation inventory includes ranked shortlist for the topic", async () => {
  const { messages, emit } = collect();
  const fakeClient = {
    async respond(body: Record<string, unknown>) {
      if (Array.isArray(body.input)) {
        return {
          sessionId: "dataset-shortlist-session",
          payload: {
            id: "dataset-shortlist-final",
            output_text: "Recommendation ready",
            output: [{ type: "message", content: [{ type: "output_text", text: "Recommendation ready" }] }],
          },
        };
      }
      return {
        sessionId: "dataset-shortlist-session",
        payload: {
          id: "dataset-shortlist-plan",
          output: [{
            type: "function_call",
            call_id: "call-datasets",
            name: "list_remote_datasets",
            arguments: JSON.stringify({
              topic: "housing affordability county-month affordability metrics",
              limit: 3,
            }),
          }],
        },
      };
    },
    async appendSessionEntry() {
      return { id: "entry-1" };
    },
    async listDatasets() {
      return {
        datasets: [
          { id: "econ-housing", name: "Housing Economics", status: "ready", createdAt: "2026-04-22T00:00:00.000Z" },
          { id: "econ", name: "Macro Economics", status: "ready", createdAt: "2026-04-21T00:00:00.000Z" },
          { id: "tweets", name: "Tweets", status: "ready", createdAt: "2026-04-20T00:00:00.000Z" },
        ],
      };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };

  await runAgentTurn(
    "I want to research housing affordability. Which dataset should I use, or do I need to build a new one?",
    session,
    emit,
    undefined,
    deps,
  );

  const joined = messages.map((message) => message.content).join("\n");
  assert.match(joined, /Found 3 remote datasets\./);
  assert.match(joined, /Top matches for "housing affordability county-month affordability metrics":/);
  assert.match(joined, /1\. econ-housing \(ready, score \d+\) - name overlap: housing/);
  assert.match(joined, /2\. econ \(ready, score \d+\) - ready existing environment/);
});

test("async query run returns immediately with canonical dashboard and terminal links", async () => {
  const calls: string[] = [];
  let startedPrompt = "";
  let startedOptions: Record<string, unknown> | undefined;
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
    async startRun(_datasetId: string, prompt: string, options?: Record<string, unknown>) {
      calls.push("startRun");
      startedPrompt = prompt;
      startedOptions = options;
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
  assert.match(final, /Run: run-123 \(starting\)/);
  assert.match(final, /research show active runs/);
  assert.match(final, /https:\/\/dashboard\.alpharesearch\.nyc\/\?view=runs&runId=run-123#run-run-123/);
  assert.doesNotMatch(final, /Terminal session:/);
  assert.equal(calls.includes("startRun"), true);
  assert.match(startedPrompt, /Mounted dataset grounding is mandatory for dataset `enriched-tweets`/);
  assert.match(startedPrompt, /Do not download public sample data, GitHub CSVs/);
  assert.deepEqual((startedOptions?.config as Record<string, unknown>)?.mountedDatasetGrounding, {
    required: true,
    datasetId: "enriched-tweets",
    mountPaths: [
      "/mnt/alpha-research/data/instances/enriched-tweets",
      "/mnt/alpha-research/datasets/enriched-tweets",
      "dataset",
    ],
    failOnUnreadable: true,
    disallowExternalFallback: true,
  });
});

test("dataset describe request starts briefing run with required artifacts", async () => {
  let startedDatasetId = "";
  let startedPrompt = "";
  let startedOptions: Record<string, unknown> | undefined;
  const fakeClient = {
    async respond() {
      return {
        sessionId: "terminal-session-describe",
        payload: {
          id: "response-describe",
          output: [{
            type: "function_call",
            call_id: "call-describe",
            name: "describe_remote_dataset",
            arguments: JSON.stringify({ datasetId: "econ" }),
          }],
        },
      };
    },
    async listDatasets() {
      return { datasets: [{ id: "econ", name: "Economics", status: "ready" }] };
    },
    async startRun(datasetId: string, prompt: string, options?: Record<string, unknown>) {
      startedDatasetId = datasetId;
      startedPrompt = prompt;
      startedOptions = options;
      return {
        run: {
          id: "run-describe",
          datasetId,
          status: "booting",
          prompt,
          createdAt: "2026-04-29T00:00:00.000Z",
          updatedAt: "2026-04-29T00:00:00.000Z",
        },
      };
    },
    async appendSessionEntry() {
      return { id: "entry-describe" };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn("describe dataset econ", session, emit, undefined, deps);

  assert.equal(startedDatasetId, "econ");
  assert.equal(startedOptions?.type, "describe");
  assert.deepEqual(startedOptions?.artifacts, [
    { type: "markdown", title: "Dataset Briefing" },
    { type: "json", title: "Dataset Profile" },
  ]);
  assert.equal((startedOptions?.config as Record<string, unknown>)?.describeDataset, true);
  assert.deepEqual((startedOptions?.config as Record<string, unknown>)?.mountedDatasetGrounding, {
    required: true,
    datasetId: "econ",
    mountPaths: [
      "/mnt/alpha-research/data/instances/econ",
      "/mnt/alpha-research/datasets/econ",
      "dataset",
    ],
    failOnUnreadable: true,
    disallowExternalFallback: true,
  });
  assert.match(startedPrompt, /Dataset Briefing/);
  assert.match(startedPrompt, /Dataset Profile/);
  assert.match(startedPrompt, /Overview; Readiness & Trust; Data Inventory; Sources; Schemas; Time Coverage; Geography Coverage; Formats; Transformations & Derived Fields; Quality & Validation; Limitations & Known Gaps; Usable Next Steps/);
  assert.match(startedPrompt, /whether the dataset is usable right now/);
  assert.match(startedPrompt, /what evidence supports that judgment/);
  assert.match(startedPrompt, /what would make it unsafe or premature to use/);
  assert.match(startedPrompt, /Do not include query instructions, starter analyses, or suggestions/);
  assert.doesNotMatch(startedPrompt, /Suggested follow-ups/);

  const final = messages.at(-1)?.content ?? "";
  assert.match(messages.map((message) => message.content).join("\n"), /Using dataset Economics \(econ\) for this briefing/);
  assert.match(final, /Started dataset briefing run run-describe for econ/);
  assert.match(final, /Expected artifacts: Dataset Briefing, Dataset Profile/);
  assert.match(final, /Run: run-describe \(starting\)/);
  assert.match(final, /research show active runs/);
  assert.doesNotMatch(final, /Terminal session:/);
});

test("specific viral tweets experiment starts with user-facing analysis summary and artifact expectations", async () => {
  const fakeClient = {
    async respond() {
      return {
        sessionId: "viral-session",
        payload: {
          id: "response-viral",
          output: [
            {
              type: "function_call",
              call_id: "call-list",
              name: "list_remote_datasets",
              arguments: JSON.stringify({}),
            },
            {
              type: "function_call",
              call_id: "call-inspect",
              name: "inspect_remote_dataset",
              arguments: JSON.stringify({ datasetId: "enriched-tweets" }),
            },
            {
              type: "function_call",
              call_id: "call-transform",
              name: "run_remote_transformation",
              arguments: JSON.stringify({
                datasetId: "enriched-tweets",
                prompt: "Using enriched-tweets, define viral tweets as the top 0.1% by quote_tweet_count. Randomly sample 100 viral tweets, label each for hook_type, emotional_tone, and controversy_level using strict JSON, then produce a bar chart and 10 representative examples.",
              }),
            },
          ],
        },
      };
    },
    async listDatasets() {
      return { datasets: [{ id: "enriched-tweets", name: "Enriched Tweets", status: "ready" }] };
    },
    async getDataset(datasetId: string) {
      return {
        dataset: {
          id: datasetId,
          name: "Enriched Tweets",
          status: "ready",
          fields: ["tweet_id", "quoted_tweet_id", "quote_tweet_count", "text"],
        },
      };
    },
    async startRun(datasetId: string, prompt: string, options?: Record<string, unknown>) {
      return {
        run: {
          id: "run-transform-viral",
          datasetId,
          status: "queued",
          prompt,
          createdAt: "2026-05-01T19:42:40.000Z",
          updatedAt: "2026-05-01T19:42:40.000Z",
        },
        artifacts: [
          { type: "chart", title: "Bar Chart" },
          { type: "json", title: "Strict JSON Labels" },
          { type: "markdown", title: "Representative Examples" },
        ],
        ...(options ? { options } : {}),
      };
    },
    async appendSessionEntry() {
      return { id: "entry-viral" };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn(
    "Using enriched-tweets, define viral tweets as the top 0.1% by quote_tweet_count. Randomly sample 100 viral tweets, label each for hook_type, emotional_tone, and controversy_level using strict JSON, then produce a bar chart and 10 representative examples.",
    session,
    emit,
    undefined,
    deps,
  );

  const joinedMessages = messages.map((message) => message.content).join("\n");
  assert.match(joinedMessages, /Checking remote datasets/);
  assert.match(joinedMessages, /Inspecting dataset enriched-tweets/);
  assert.match(joinedMessages, /Starting remote analysis for enriched-tweets/);
  assert.doesNotMatch(joinedMessages, /Running run_remote_transformation/);
  assert.match(joinedMessages, /Started remote analysis on enriched-tweets/);
  assert.match(joinedMessages, /Run: run-transform-viral \(queued\)/);
  assert.match(joinedMessages, /Expected artifacts: bar chart, structured JSON results, representative examples/);
  assert.match(joinedMessages, /research show active runs/);
  assert.match(joinedMessages, /Dashboard: https:\/\/dashboard\.alpharesearch\.nyc\/\?view=runs&runId=run-transform-viral#run-run-transform-viral/);
  assert.doesNotMatch(joinedMessages, /Terminal session:/);
});

test("dataset inspection surfaces schema evidence for requested analysis fields", async () => {
  const fakeClient = {
    async respond(body: Record<string, unknown>) {
      if (Array.isArray(body.input)) {
        return {
          sessionId: "terminal-session-inspect",
          payload: {
            id: "response-inspect-2",
            output_text: "Inspection complete.",
            output: [{ type: "message", content: [{ type: "output_text", text: "Inspection complete." }] }],
          },
        };
      }
      return {
        sessionId: "terminal-session-inspect",
        payload: {
          id: "response-inspect",
          output: [{
            type: "function_call",
            call_id: "call-inspect",
            name: "inspect_remote_dataset",
            arguments: JSON.stringify({ datasetId: "econ" }),
          }],
        },
      };
    },
    async getDataset(datasetId: string) {
      assert.equal(datasetId, "econ");
      return {
        dataset: {
          id: "econ",
          name: "Economics",
          status: "ready",
          profile: {
            schema: [
              { name: "county_name", type: "string" },
              { name: "year", type: "integer" },
              { name: "unemployment_rate", type: "number" },
              { name: "median_home_value", type: "number" },
            ],
            timeCoverage: { start: "2010", end: "2024" },
            geographyCoverage: { level: "county" },
            notes: "County-year economics panel.",
          },
        },
      };
    },
    async appendSessionEntry() {
      return { id: "entry-inspect" };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn("inspect econ", session, emit, undefined, deps);

  const joined = messages.map((message) => message.content).join("\n");
  assert.match(joined, /econ appears to include county, time, unemployment, and home value fields/i);
  assert.match(joined, /county_name, year, unemployment_rate, median_home_value/i);
  assert.match(joined, /Coverage: 2010 to 2024 at county level/i);
});

test("busy dataset conflict explains active run and emits heartbeat while waiting", async () => {
  const originalHeartbeat = process.env.RESEARCH_TOOL_HEARTBEAT_INTERVAL_MS;
  process.env.RESEARCH_TOOL_HEARTBEAT_INTERVAL_MS = "25";
  try {
    const fakeClient = {
      async respond(body: Record<string, unknown>) {
        if (Array.isArray(body.input)) {
          return {
            sessionId: "terminal-session-busy",
            payload: {
              id: "response-busy-2",
              output_text: "Busy run noted.",
              output: [{ type: "message", content: [{ type: "output_text", text: "Busy run noted." }] }],
            },
          };
        }
        return {
          sessionId: "terminal-session-busy",
          payload: {
            id: "response-busy",
            output: [{
              type: "function_call",
              call_id: "call-busy",
              name: "create_research_environment",
              arguments: JSON.stringify({
                datasetId: "econ",
                name: "Economics",
                sourceDescription: "Existing economics dataset",
                prompt: "Analyze unemployment versus home values.",
                artifacts: [
                  { type: "table", title: "Correlation table" },
                  { type: "chart", title: "Scatter plot" },
                  { type: "markdown", title: "Markdown summary" },
                ],
              }),
            }],
          },
        };
      },
      async listDatasets() {
        return { datasets: [{ id: "econ", name: "Economics", status: "ready" }] };
      },
      async createDataset() {
        return { dataset: { id: "econ", name: "Economics", status: "ready" } };
      },
      async createResearchEnvironment() {
        await new Promise((resolve) => setTimeout(resolve, 60));
        throw new RemoteRequestError(
          "Remote request failed (409) for /api/cli/datasets/econ/environment. {\"error\":\"dataset has an active run holding its volume\",\"activeRuns\":[{\"id\":\"run-busy\",\"datasetId\":\"econ\",\"status\":\"booting\",\"prompt\":\"Compare unemployment and home values\"}]}",
          409,
          "/api/cli/datasets/econ/environment",
        );
      },
      async appendSessionEntry() {
        return { id: "entry-busy" };
      },
    };
    const deps: AgentRuntimeDeps = {
      ...createDefaultAgentRuntimeDeps(),
      createRemoteClient: () => fakeClient as never,
      readSession: async () => session,
    };
    const { messages, emit } = collect();

    await runAgentTurn("run the econ analysis", session, emit, undefined, deps);

    const joined = messages.map((message) => message.content).join("\n");
    assert.match(joined, /Expected artifacts: Correlation table; Scatter plot; Markdown summary\./);
    assert.match(joined, /Still preparing the econ environment and checking whether the dataset volume is free/i);
    assert.match(joined, /An analysis is already running on econ\./);
    assert.match(joined, /I did not start a duplicate run/i);
    assert.match(joined, /Dashboard run: https:\/\/dashboard\.alpharesearch\.nyc\/\?view=runs&runId=run-busy#run-run-busy/);
    assert.match(joined, /Inspect in CLI: research debug run run-busy/);
  } finally {
    if (originalHeartbeat === undefined) {
      delete process.env.RESEARCH_TOOL_HEARTBEAT_INTERVAL_MS;
    } else {
      process.env.RESEARCH_TOOL_HEARTBEAT_INTERVAL_MS = originalHeartbeat;
    }
  }
});

test("dataset describe request falls back to saved briefing when dataset is busy", async () => {
  const fakeClient = {
    async respond() {
      return {
        sessionId: "terminal-session-describe-busy",
        payload: {
          id: "response-describe-busy",
          output: [{
            type: "function_call",
            call_id: "call-describe-busy",
            name: "describe_remote_dataset",
            arguments: JSON.stringify({ datasetId: "econ" }),
          }],
        },
      };
    },
    async startRun() {
      throw new RemoteRequestError(
        'Remote request failed (409) for /api/cli/datasets/econ/runs. {"error":"dataset has an active run holding its volume","activeRuns":[{"id":"run-econ-busy","status":"running"}]}',
        409,
        "/api/cli/datasets/econ/runs",
      );
    },
    async getDataset() {
      return {
        dataset: {
          id: "econ",
          name: "Economic Indicators",
          status: "ready",
          profile: {
            briefingMarkdown: [
              "Overview",
              "Economic indicators dataset with normalized macro tables.",
              "",
              "Readiness & Trust",
              "Usable now.",
              "",
              "Sources",
              "FRED",
              "",
              "Quality & Validation",
              "Validated schemas.",
            ].join("\n"),
            briefingArtifactId: "artifact-briefing",
            profileArtifactId: "artifact-profile",
            describedAt: "2026-04-30T12:00:00.000Z",
          },
        },
      };
    },
    async appendSessionEntry() {
      return { id: "entry-describe-busy" };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn("describe the econ dataset", session, emit, undefined, deps);

  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /Using the latest saved dataset briefing for econ while run run-econ-busy is running/);
  assert.match(final, /Readiness & Trust/);
  assert.match(final, /FRED/);
  assert.match(final, /Artifacts: Dataset Briefing and Dataset Profile/);
  assert.doesNotMatch(final, /Started dataset briefing run/);
});

test("run result retrieval includes selected run context and artifacts", async () => {
  const now = Date.now();
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
    createToolRegistry,
  };
  const { messages, emit } = collect();

  const originalEnv = process.env.RESEARCH_SESSION_DIR;
  const sessionDir = await mkdtemp(join(tmpdir(), "research-last-run-single-"));
  process.env.RESEARCH_SESSION_DIR = sessionDir;
  try {
    await writeTrackedRuns([{
      id: "run-456",
      datasetId: "enriched-tweets",
      origin: "https://dashboard.alpharesearch.nyc",
      status: "ready",
      prompt: "Quick sanity check.",
      createdAt: new Date(now - 20 * 60_000).toISOString(),
      updatedAt: new Date(now - 10 * 60_000).toISOString(),
      lastSeenAt: new Date(now - 10 * 60_000).toISOString(),
      terminalAt: new Date(now - 10 * 60_000).toISOString(),
    }]);
    await runAgentTurn("what was my last result?", session, emit, undefined, deps);
  } finally {
    process.env.RESEARCH_SESSION_DIR = originalEnv;
  }

  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /Selected your most recent tracked run because it already completed\./);
  assert.match(final, /Selected run: enriched-tweets/);
  assert.match(final, /Request: Quick sanity check\./);
  assert.match(final, /Artifacts/);
});

test("last run results select the latest completed run and explain newer active runs", async () => {
  const now = Date.now();
  const trackedRuns = [
    {
      id: "run-active-1",
      datasetId: "econ",
      origin: "https://dashboard.alpharesearch.nyc",
      status: "booting",
      createdAt: new Date(now - 5 * 60_000).toISOString(),
      updatedAt: new Date(now - 2 * 60_000).toISOString(),
      lastSeenAt: new Date(now - 2 * 60_000).toISOString(),
    },
    {
      id: "run-active-2",
      datasetId: "labor",
      origin: "https://dashboard.alpharesearch.nyc",
      status: "running",
      createdAt: new Date(now - 8 * 60_000).toISOString(),
      updatedAt: new Date(now - 4 * 60_000).toISOString(),
      lastSeenAt: new Date(now - 4 * 60_000).toISOString(),
    },
    {
      id: "run-complete",
      datasetId: "enriched-tweets",
      origin: "https://dashboard.alpharesearch.nyc",
      status: "ready",
      createdAt: new Date(now - 30 * 60_000).toISOString(),
      updatedAt: new Date(now - 20 * 60_000).toISOString(),
      lastSeenAt: new Date(now - 20 * 60_000).toISOString(),
      terminalAt: new Date(now - 20 * 60_000).toISOString(),
    },
  ];
  const fakeClient = {
    async getRunResults(runId: string) {
      assert.equal(runId, "run-complete");
      return {
        run: {
          id: runId,
          datasetId: "enriched-tweets",
          status: "ready",
          prompt: "Show me the summary.",
        },
        metadata: { artifactSpec: [] },
        events: [],
        artifacts: [{
          id: "artifact-summary",
          runId,
          type: "remote_agent_summary",
          title: "Remote Agent Summary",
          content: "Confirmed the dataset is loaded and summarized the latest findings.",
        }],
      };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
    createToolRegistry,
  };
  const { messages, emit } = collect();

  const originalEnv = process.env.RESEARCH_SESSION_DIR;
  const sessionDir = await mkdtemp(join(tmpdir(), "research-last-run-"));
  process.env.RESEARCH_SESSION_DIR = sessionDir;
  try {
    await writeTrackedRuns(trackedRuns);
    await runAgentTurn("Show me the results from my last run.", session, emit, undefined, deps);
  } finally {
    process.env.RESEARCH_SESSION_DIR = originalEnv;
  }

  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /Selected your most recent completed run because newer tracked runs are still in progress\./);
  assert.match(final, /Selected run: enriched-tweets/);
  assert.match(final, /Result preview/);
  assert.match(final, /Also active/);
  assert.doesNotMatch(final, /run-complete ·/);
});

test("last run results report an in-progress latest run when nothing has completed", async () => {
  const now = Date.now();
  const trackedRuns = [
    {
      id: "run-active",
      datasetId: "econ",
      origin: "https://dashboard.alpharesearch.nyc",
      status: "running",
      prompt: "Build the panel and summarize it.",
      createdAt: new Date(now - 10 * 60_000).toISOString(),
      updatedAt: new Date(now - 2 * 60_000).toISOString(),
      lastSeenAt: new Date(now - 2 * 60_000).toISOString(),
    },
  ];
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => ({}) as never,
    readSession: async () => session,
    createToolRegistry,
  };
  const { messages, emit } = collect();

  const originalEnv = process.env.RESEARCH_SESSION_DIR;
  const sessionDir = await mkdtemp(join(tmpdir(), "research-last-run-active-"));
  process.env.RESEARCH_SESSION_DIR = sessionDir;
  try {
    await writeTrackedRuns(trackedRuns);
    await runAgentTurn("what was my last result?", session, emit, undefined, deps);
  } finally {
    process.env.RESEARCH_SESSION_DIR = originalEnv;
  }

  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /still in progress, so there are no finished results to show yet/);
  assert.match(final, /Selected run: econ/);
  assert.match(final, /Debug: research debug run run-active/);
});

test("last run results report a failed latest run when nothing completed successfully", async () => {
  const now = Date.now();
  const trackedRuns = [
    {
      id: "run-failed",
      datasetId: "housing",
      origin: "https://dashboard.alpharesearch.nyc",
      status: "failed",
      createdAt: new Date(now - 20 * 60_000).toISOString(),
      updatedAt: new Date(now - 15 * 60_000).toISOString(),
      lastSeenAt: new Date(now - 15 * 60_000).toISOString(),
      terminalAt: new Date(now - 15 * 60_000).toISOString(),
    },
  ];
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => ({}) as never,
    readSession: async () => session,
    createToolRegistry,
  };
  const { messages, emit } = collect();

  const originalEnv = process.env.RESEARCH_SESSION_DIR;
  const sessionDir = await mkdtemp(join(tmpdir(), "research-last-run-failed-"));
  process.env.RESEARCH_SESSION_DIR = sessionDir;
  try {
    await writeTrackedRuns(trackedRuns);
    await runAgentTurn("show me the results from my last run", session, emit, undefined, deps);
  } finally {
    process.env.RESEARCH_SESSION_DIR = originalEnv;
  }

  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /did not complete successfully/);
  assert.match(final, /Selected run: housing/);
  assert.match(final, /Debug: research debug run run-failed/);
});

test("continuity question returns compact lifecycle summary without tool chatter", async () => {
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    readTrackedRuns: async () => [
      {
        id: "run-active",
        datasetId: "econ",
        origin: session.origin,
        status: "running",
        prompt: "Build county-month panel",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:05:00.000Z",
        lastSeenAt: "2026-05-01T00:05:00.000Z",
      },
      {
        id: "run-completed",
        datasetId: "enriched-tweets",
        origin: session.origin,
        status: "ready",
        prompt: "Return a sanity summary.",
        createdAt: "2026-04-30T00:00:00.000Z",
        updatedAt: "2026-04-30T00:10:00.000Z",
        lastSeenAt: "2026-04-30T00:10:00.000Z",
        terminalAt: "2026-04-30T00:10:00.000Z",
      },
      {
        id: "run-blocked",
        datasetId: "housing",
        origin: session.origin,
        status: "worker_unreachable",
        prompt: "Refresh data sources",
        createdAt: "2026-04-29T00:00:00.000Z",
        updatedAt: "2026-04-29T00:05:00.000Z",
        lastSeenAt: "2026-04-29T00:05:00.000Z",
        terminalAt: "2026-04-29T00:05:00.000Z",
      },
    ],
    createRemoteClient: () => ({
      async getRunResults() {
        return {
          run: {
            id: "run-completed",
            datasetId: "enriched-tweets",
            status: "ready",
            prompt: "Return a sanity summary.",
          },
          metadata: null,
          events: [],
          artifacts: [
            {
              id: "artifact-summary",
              runId: "run-completed",
              type: "markdown",
              title: "summary.md",
            },
            {
              id: "artifact-result",
              runId: "run-completed",
              type: "structured_result",
              title: "result.json",
              content: { total_rows: 10 },
            },
          ],
        };
      },
    }) as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();
  await runAgentTurn("I came back later. What happened with my research work, and what results or artifacts can I see?", session, emit, undefined, deps);

  assert.equal(messages.some((message) => message.role === "tool"), false);
  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /1 active, 1 completed, 1 blocked run/);
  assert.match(final, /Most relevant result: enriched-tweets \(run-…eted\) finished successfully\./);
  assert.match(final, /Best artifacts: summary\.md and result\.json\./);
  assert.match(final, /Active\n- econ \(run-…tive\): Build county-month panel\./);
  assert.match(final, /Blocked\n- housing \(run-…cked\): worker state needs reconciliation\./);
  assert.match(final, /Best next step: wait on econ \(run-…tive\)/);
  assert.doesNotMatch(final, /Running list_run_artifacts|Checking run history|Remote Agent Transcript|No produced artifacts found/);
});

test("non-resumable run continuation returns artifacts instead of crashing", async () => {
  const calls: string[] = [];
  const fakeClient = {
    async respond(body: Record<string, unknown>) {
      calls.push("respond");
      if (Array.isArray(body.input)) {
        const toolOutput = JSON.parse(String((body.input[0] as Record<string, unknown>).output)) as {
          summary: string;
          data: { reason?: string; artifacts?: Array<{ title: string }> };
        };
        assert.equal(toolOutput.data.reason, "not_resumable");
        assert.equal(toolOutput.data.artifacts?.[0]?.title, "Remote Agent Summary");
        return {
          sessionId: "terminal-session-non-resumable",
          payload: {
            id: "response-non-resumable-2",
            output_text: `Could not resume. ${toolOutput.summary}`,
            output: [{
              type: "message",
              content: [{ type: "output_text", text: `Could not resume. ${toolOutput.summary}` }],
            }],
          },
        };
      }
      return {
        sessionId: "terminal-session-non-resumable",
        payload: {
          id: "response-non-resumable-1",
          output: [{
            type: "function_call",
            call_id: "call-non-resumable",
            name: "continue_remote_agent_run",
            arguments: JSON.stringify({
              runId: "run-no-session",
              prompt: "Continue from the prior output.",
            }),
          }],
        },
      };
    },
    async getRunResults() {
      calls.push("getRunResults");
      return {
        run: {
          id: "run-no-session",
          datasetId: "econ",
          status: "ready",
          prompt: "Original run.",
        },
        metadata: null,
        events: [],
        artifacts: [{
          id: "artifact-summary",
          runId: "run-no-session",
          type: "markdown",
          title: "Remote Agent Summary",
          content: "Finished without a resumable session.",
        }],
      };
    },
    async startRun() {
      calls.push("startRun");
      throw new Error("startRun should not be called for a non-resumable continuation.");
    },
    async appendSessionEntry() {
      calls.push("appendSessionEntry");
      return { id: "entry-non-resumable" };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn("continue run-no-session", session, emit, undefined, deps);

  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /does not have a resumable remote agent session/);
  assert.equal(calls.includes("getRunResults"), true);
  assert.equal(calls.includes("startRun"), false);
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
        'Remote request failed (409) for /api/cli/datasets/busy-dataset/runs. {"error":"dataset has an active run holding its volume","activeRuns":[{"id":"run-blocking","status":"running","createdAt":"2026-05-01T19:40:00.000Z","updatedAt":"2026-05-01T19:44:00.000Z"}]}',
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
  assert.match(joined, /Blocked: .* is waiting on an active dataset run/);
  assert.match(joined, /Using dataset busy-dataset for /);
  assert.match(joined, /Active run: run-blocking/);
  assert.match(joined, /An analysis is already running on this dataset\./);
  assert.match(joined, /I did not start a duplicate run/);
  assert.match(joined, /Started: 2026-05-01T19:40:00.000Z/);
  assert.match(joined, /Last update: 2026-05-01T19:44:00.000Z/);
  assert.match(joined, /No new run was started/);
  assert.match(joined, /Next steps:/);
  assert.match(joined, /Inspect now: `research debug run run-blocking`/);
  assert.match(joined, /https:\/\/dashboard\.alpharesearch\.nyc\/\?view=runs&runId=run-blocking#run-run-blocking/);
  assert.match(joined, /When it finishes, ask: show results from run-blocking/);
  assert.match(joined, /Inspect in CLI: research debug run run-blocking/);
});

test("dataset describe conflict keeps guidance anchored on briefing artifacts", async () => {
  const fakeClient = {
    async respond() {
      return {
        sessionId: "terminal-session-describe-busy",
        payload: {
          id: "response-describe-busy",
          output: [{
            type: "function_call",
            call_id: "call-describe-busy",
            name: "describe_remote_dataset",
            arguments: JSON.stringify({ datasetId: "econ" }),
          }],
        },
      };
    },
    async listDatasets() {
      return { datasets: [{ id: "econ", name: "Economics", status: "ready" }] };
    },
    async startRun() {
      throw new RemoteRequestError(
        'Remote request failed (409) for /api/cli/datasets/econ/runs. {"error":"dataset has an active run holding its volume","activeRuns":[{"id":"run-briefing","status":"running"}]}',
        409,
        "/api/cli/datasets/econ/runs",
      );
    },
    async appendSessionEntry() {
      return { id: "entry-describe-busy" };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn("Describe the econ dataset for me.", session, emit, undefined, deps);

  const joined = messages.map((message) => message.content).join("\n");
  assert.match(joined, /Using dataset Economics \(econ\) for this briefing/);
  assert.match(joined, /Blocked: this dataset briefing is waiting on an active dataset run/);
  assert.match(joined, /Expected artifacts once the run finishes: Dataset Briefing, Dataset Profile/);
  assert.match(joined, /When it finishes, ask: show results from run-briefing/);
  assert.match(joined, /If it seems stuck, debug: research debug run run-briefing/);
});

test("prompt-mode busy dataset shortcut shows age, health, and clear actions", { concurrency: false }, async () => {
  const datasetId = "enriched-tweets-busy-local";
  const previousRuns = await readFile(RUNS_PATH, "utf8").catch(() => null);
  try {
    await mkdir(dirname(RUNS_PATH), { recursive: true });
    await writeFile(RUNS_PATH, `${JSON.stringify([{
      id: "run-local-blocker",
      datasetId,
      origin: session.origin,
      status: "booting",
      dashboardUrl: "https://dashboard.alpharesearch.nyc/?view=runs&runId=run-local-blocker#run-run-local-blocker",
      createdAt: "2026-05-01T19:40:00.000Z",
      updatedAt: "2026-05-01T19:44:00.000Z",
      lastSeenAt: "2026-05-01T19:44:00.000Z",
    }], null, 2)}\n`, "utf8");

    const fakeClient = {
      async respond() {
        throw new Error("Busy dataset shortcut should return before remote planning.");
      },
    };
    const deps: AgentRuntimeDeps = {
      ...createDefaultAgentRuntimeDeps(),
      createRemoteClient: () => fakeClient as never,
      readSession: async () => session,
    };
    const { messages, emit } = collect();

    await runAgentTurn(`Run a new analysis on ${datasetId}.`, session, emit, undefined, deps);

    const final = messages.at(-1)?.content ?? "";
    assert.match(final, new RegExp(`Blocked: ${datasetId} is already busy\\.`));
    assert.match(final, /Status: booting/);
    assert.match(final, /Started: 2026-05-01T19:40:00.000Z/);
    assert.match(final, /Last update: 2026-05-01T19:44:00.000Z/);
    assert.match(final, /holding the dataset lock/);
    assert.match(final, /worth inspecting|expected while the worker starts/);
    assert.match(final, /Inspect now: `research debug run run-local-blocker`/);
    assert.match(final, /Open dashboard: https:\/\/dashboard\.alpharesearch\.nyc\/\?view=runs&runId=run-local-blocker#run-run-local-blocker/);
    assert.match(final, /Wait for the active run to finish, or cancel it if you confirm it is stuck\./);
  } finally {
    if (previousRuns === null) {
      await rm(RUNS_PATH, { force: true }).catch(() => {});
    } else {
      await writeFile(RUNS_PATH, previousRuns, "utf8");
    }
  }
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
  assert.equal(bundle.lifecycle.classification, "terminal_failure");
  assert.deepEqual(bundle.remote.events, { events: [{ id: "evt-1", runId: "run-debug-1", message: "Failed." }] });
});

test("run debug bundle classifies worker-unreachable state as lifecycle-uncertain", async () => {
  const bundle = await buildRunDebugBundle("run-unknown-1", {
    readSession: async () => ({
      origin: "https://alpharesearch.nyc",
      accessToken: "test-token-secret",
      createdAt: "2026-04-22T00:00:00.000Z",
    }),
    createRemoteClient: () => ({
      async getRun() {
        return { run: { id: "run-unknown-1", datasetId: "dataset", status: "worker_unreachable" } };
      },
      async getRunResults() {
        return {
          run: { id: "run-unknown-1", datasetId: "dataset", status: "worker_unreachable" },
          metadata: { artifactSpec: [] },
          events: [{ id: "evt-1", runId: "run-unknown-1", message: "Worker callback timed out." }],
          artifacts: [],
        };
      },
      async getRunEvents() {
        return { events: [{ id: "evt-1", runId: "run-unknown-1", message: "Worker callback timed out." }] };
      },
      async getRunArtifacts() {
        return { artifacts: [] };
      },
    }),
    readTrackedRuns: async () => [],
    now: () => new Date("2026-04-22T12:00:00.000Z"),
  });

  assert.equal(bundle.lifecycle.classification, "terminal_uncertain");
  assert.match(bundle.lifecycle.message, /reconciled|reconciliation/);
});

test("stuck run question explains fresh booting run in plain language", async () => {
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    readSession: async () => session,
    readTrackedRuns: async () => [{
      id: "run-fresh-1",
      datasetId: "enriched-tweets",
      origin: session.origin,
      status: "booting",
      prompt: "Mounted dataset grounding is mandatory for dataset `enriched-tweets`.\nBefore doing analysis, read the mount.",
      createdAt: "2026-04-22T00:00:00.000Z",
      updatedAt: "2026-04-22T00:00:00.000Z",
      lastSeenAt: "2026-04-22T00:00:00.000Z",
    }],
    now: () => new Date("2026-04-22T00:00:30.000Z").getTime(),
  };
  const { messages, emit } = collect();

  await runAgentTurn("My last run seems stuck. What’s happening?", session, emit, undefined, deps);

  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /does not look stuck yet/i);
  assert.match(final, /Waiting for dataset enriched-tweets to be mounted/i);
  assert.match(final, /wait 1-2 minutes/i);
  assert.match(final, /research debug run run-fresh-1/);
  assert.doesNotMatch(final, /Mounted dataset grounding is mandatory/i);
});

test("stuck run question escalates stale running run to debug now", async () => {
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    readSession: async () => session,
    readTrackedRuns: async () => [{
      id: "run-stale-1",
      datasetId: "econ",
      origin: session.origin,
      status: "running",
      prompt: "Analyze housing risk trends.",
      createdAt: "2026-04-22T00:00:00.000Z",
      updatedAt: "2026-04-22T00:00:00.000Z",
      lastSeenAt: "2026-04-22T00:00:00.000Z",
      lastEventMessage: "Computing grouped aggregates.",
    }],
    now: () => new Date("2026-04-22T00:05:00.000Z").getTime(),
  };
  const { messages, emit } = collect();

  await runAgentTurn("My last run seems stuck. What’s happening?", session, emit, undefined, deps);

  const final = messages.at(-1)?.content ?? "";
  assert.match(final, /may be stalled/i);
  assert.match(final, /Computing grouped aggregates\./i);
  assert.match(final, /run `research debug run run-stale-1` now/i);
  assert.match(final, /Last update: 5 minutes ago/i);
});

test("canonical public environments use small versioned object-store resource profile", async () => {
  const calls: Array<{ name: string; body?: Record<string, unknown> }> = [];
  const fakeClient = {
    async respond(body: Record<string, unknown>) {
      if (Array.isArray(body.input)) {
        return {
          sessionId: "terminal-session-canonical-resources",
          payload: {
            id: "response-canonical-resources-final",
            output_text: "Started canonical build.",
            output: [{ type: "message", content: [{ type: "output_text", text: "Started canonical build." }] }],
          },
        };
      }
      return {
        sessionId: "terminal-session-canonical-resources",
        payload: {
          id: "response-canonical-resources",
          output: [{
            type: "function_call",
            call_id: "call-canonical-resources",
            name: "create_public_data_environment",
            arguments: JSON.stringify({
              datasetId: "sociology",
              name: "Sociology",
              sourceDescription: "Canonical public sociology sources.",
              prompt: "Build the canonical public Sociology dataset.",
            }),
          }],
        },
      };
    },
    async listDatasets() {
      calls.push({ name: "listDatasets" });
      return { datasets: [] };
    },
    async createPublicDataEnvironment(datasetId: string, body: Record<string, unknown>) {
      calls.push({ name: "createPublicDataEnvironment", body: { datasetId, ...body } });
      return {
        dataset: null,
        environment: { datasetId, status: "booting" },
        run: {
          id: "run-canonical-resources",
          datasetId,
          status: "booting",
          prompt: String(body.prompt),
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-01T00:00:00.000Z",
        },
      };
    },
    async appendSessionEntry() {
      return { id: "entry-canonical-resources" };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { emit } = collect();

  await runAgentTurn("Create the canonical sociology dataset.", session, emit, undefined, deps);

  const environmentCall = calls.find((call) => call.name === "createPublicDataEnvironment");
  assert.deepEqual(environmentCall?.body?.resources, {
    profile: "canonical-public",
    runnerSize: "s-4vcpu-8gb",
    workspaceDiskGb: 50,
    storageMode: "object-store-versioned",
    datasetAccess: "read-only-version",
    publishMode: "versioned",
  });
});

test("environment builds support explicit large-ingest resource profile", async () => {
  const calls: Array<{ name: string; body?: Record<string, unknown> }> = [];
  const fakeClient = {
    async respond(body: Record<string, unknown>) {
      if (Array.isArray(body.input)) {
        return {
          sessionId: "terminal-session-large-ingest",
          payload: {
            id: "response-large-ingest-final",
            output_text: "Started large ingest.",
            output: [{ type: "message", content: [{ type: "output_text", text: "Started large ingest." }] }],
          },
        };
      }
      return {
        sessionId: "terminal-session-large-ingest",
        payload: {
          id: "response-large-ingest",
          output: [{
            type: "function_call",
            call_id: "call-large-ingest",
            name: "create_research_environment",
            arguments: JSON.stringify({
              datasetId: "archive-corpus",
              name: "Archive Corpus",
              sourceDescription: "Large public archive corpus.",
              prompt: "Fetch and normalize a large archive corpus.",
              resourceProfile: "large-ingest",
            }),
          }],
        },
      };
    },
    async listDatasets() {
      calls.push({ name: "listDatasets" });
      return { datasets: [] };
    },
    async createDataset(body: Record<string, unknown>) {
      calls.push({ name: "createDataset", body });
      return { dataset: { id: body.datasetId, name: body.name, status: "created" } };
    },
    async createResearchEnvironment(datasetId: string, body: Record<string, unknown>) {
      calls.push({ name: "createResearchEnvironment", body: { datasetId, ...body } });
      return {
        dataset: null,
        environment: { datasetId, status: "booting" },
        run: {
          id: "run-large-ingest",
          datasetId,
          status: "booting",
          prompt: String(body.prompt),
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-01T00:00:00.000Z",
        },
      };
    },
    async appendSessionEntry() {
      return { id: "entry-large-ingest" };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { emit } = collect();

  await runAgentTurn("Create a large archive dataset.", session, emit, undefined, deps);

  const environmentCall = calls.find((call) => call.name === "createResearchEnvironment");
  assert.deepEqual(environmentCall?.body?.resources, {
    profile: "large-ingest",
    runnerSize: "s-8vcpu-16gb",
    workspaceDiskGb: 500,
    storageMode: "object-store-versioned",
    publishMode: "versioned",
  });
});

test("product planning: vague viral tweets request designs scoped experiment before running", async () => {
  const calls: string[] = [];
  const fakeClient = {
    async respond(body: Record<string, unknown>) {
      if (Array.isArray(body.input)) {
        return {
          sessionId: "planning-session",
          payload: {
            id: "planning-final",
            output_text: "unused",
            output: [{ type: "message", content: [{ type: "output_text", text: "unused" }] }],
          },
        };
      }
      return {
        sessionId: "planning-session",
        payload: {
          id: "planning-initial",
          output: [{
            type: "function_call",
            call_id: "call-inspect-tweets",
            name: "inspect_remote_dataset",
            arguments: JSON.stringify({ datasetId: "enriched-tweets" }),
          }],
        },
      };
    },
    async appendSessionEntry() {
      return { id: "entry-1" };
    },
    async getDataset(datasetId: string) {
      calls.push("getDataset");
      assert.equal(datasetId, "enriched-tweets");
      return {
        dataset: {
          id: "enriched-tweets",
          name: "Enriched Tweets",
          status: "ready",
          deploymentStatus: "ready",
          profile: {
            datasetId: "enriched-tweets",
            schema: [
              { name: "tweet_id", type: "string" },
              { name: "full_text", type: "string" },
              { name: "created_at", type: "timestamp" },
              { name: "quote_tweet_count", type: "number" },
              { name: "retweet_count", type: "number" },
              { name: "favorite_count", type: "number" },
            ],
            sampleRows: [{
              tweet_id: "tweet-1",
              full_text: "Example tweet",
              quote_tweet_count: 42,
            }],
            notes: "Quote tweet counts are available and suitable for a virality threshold.",
          },
        },
      };
    },
    async startRun() {
      calls.push("startRun");
      throw new Error("Vague planning request should not start a run before confirmation.");
    },
    async createResearchSpec() {
      calls.push("createResearchSpec");
      throw new Error("Vague planning request should not create a spec before confirmation.");
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { messages, emit } = collect();

  await runAgentTurn(
    "what's up with tweets? Can you run an experiment for me on what types of tweets go viral?",
    session,
    emit,
    undefined,
    deps,
  );

  assert.deepEqual(calls, []);
  const joinedMessages = messages.map((message) => message.content).join("\n");
  assert.doesNotMatch(joinedMessages, /Starting remote run/i);
  assert.match(joinedMessages, /Before I start a remote run/i);
  assert.match(joinedMessages, /Proposed dataset: `enriched-tweets`/i);
  assert.match(joinedMessages, /assuming it has tweet text, timestamps, and engagement fields/i);
  assert.match(joinedMessages, /top 0\.1% by `quote_tweet_count`/i);
  assert.match(joinedMessages, /sample 100 tweets/i);
  assert.match(joinedMessages, /hook_type/i);
  assert.match(joinedMessages, /emotional_tone/i);
  assert.match(joinedMessages, /controversy_level/i);
  assert.match(joinedMessages, /Choose one virality definition/i);
  assert.match(joinedMessages, /1\.\s+Top 0\.1% by `quote_tweet_count`/i);
  assert.match(joinedMessages, /2\.\s+Top 0\.1% by `retweet_count`/i);
  assert.match(joinedMessages, /3\.\s+Top 0\.1% by `favorite_count`/i);
  assert.match(joinedMessages, /reply with 1, 2, or 3/i);
});

test("field-definition prompt instructions enforce concise verdict-first answers", async () => {
  let capturedInstructions = "";
  const fakeClient = {
    async respond(body: Record<string, unknown>) {
      capturedInstructions = String(body.instructions ?? "");
      return {
        sessionId: "field-session",
        payload: {
          id: "field-final",
          output_text: "Use `quote_tweet_count` as one proxy signal, not the sole definition of virality.",
          output: [{
            type: "message",
            content: [{
              type: "output_text",
              text: "Use `quote_tweet_count` as one proxy signal, not the sole definition of virality.",
            }],
          }],
        },
      };
    },
    async appendSessionEntry() {
      return { id: "entry-field" };
    },
  };
  const deps: AgentRuntimeDeps = {
    ...createDefaultAgentRuntimeDeps(),
    createRemoteClient: () => fakeClient as never,
    readSession: async () => session,
  };
  const { emit } = collect();

  await runAgentTurn(
    "In the tweets dataset, what does quote_tweet_count mean and can I use it to define virality?",
    session,
    emit,
    undefined,
    deps,
  );

  assert.match(capturedInstructions, /answer the concept question before proposing any work/i);
  assert.match(capturedInstructions, /lead with a one-line verdict, then one short caveat/i);
  assert.match(capturedInstructions, /do not include composite formulas, top-N proposals, or offers to start analysis/i);
  assert.match(capturedInstructions, /do not use vague labels like 'typical'/i);
});

test("vague dataset interesting request gives a concise briefing and focused choice without starting a run", async () => {
  const calls: string[] = [];
  const fakeClient = {
    async listDatasets() {
      calls.push("listDatasets");
      return {
        datasets: [
          { id: "econ", name: "County-Month Housing Cycle v2", status: "ready" },
          { id: "tweets", name: "Tweets", status: "ready" },
        ],
      };
    },
    async getDataset(datasetId: string) {
      calls.push("getDataset");
      assert.equal(datasetId, "econ");
      return {
        dataset: {
          id: "econ",
          name: "County-Month Housing Cycle v2",
          status: "ready",
          profile: {
            datasetId: "econ",
            sources: [
              { name: "Census Building Permits" },
              { name: "FRED 30yr mortgage rate" },
              { name: "BEA personal income growth" },
            ],
            tables: [{ name: "county_month_panel" }],
            timeCoverage: { start: "2018-01", end: "2026-01" },
            geographyCoverage: { level: "county-month panel" },
            notes: "Income growth is missing in about 23% of county-months.",
            limitations: [
              "National mortgage rate is applied to all counties.",
              "Some permit YoY values are missing where prior-year data is absent.",
            ],
          },
        },
      };
    },
    async startRun() {
      calls.push("startRun");
      throw new Error("Vague dataset briefing should not start a run.");
    },
    async respond() {
      calls.push("respond");
      throw new Error("Vague dataset briefing should be handled locally.");
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

  await runAgentTurn(
    "Analyze the econ dataset and tell me what's interesting.",
    session,
    emit,
    undefined,
    deps,
  );

  assert.deepEqual(calls, ["listDatasets", "getDataset"]);
  const transcript = messages.map((message) => message.content).join("\n");
  assert.match(transcript, /looks most useful for rate sensitivity/i);
  assert.match(transcript, /Pick one next step: rate sensitivity, coverage quality, regional differences\./i);
  assert.match(transcript, /I will not start a broad remote analysis until you choose the scope\./i);
  assert.doesNotMatch(transcript, /deployment finishes|env turns ready|briefing\/profile/i);
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
    "listDatasets",
    "createDataset",
    "createResearchEnvironment",
    "createResearchSpec",
    "listDatasets",
    "startRun",
    "listDatasets",
    "startRun",
    "listDatasets",
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
  assert.match(joinedMessages, /No remote datasets found; a new build will be needed if the plan proceeds\./);
  assert.match(joinedMessages, /Reviewing remote datasets and drafting the next step\.\.\./);
  assert.match(joinedMessages, /Created research spec spec-housing-rates/);
  assert.match(joinedMessages, /Running run_remote_transformation\.\.\./);
  assert.match(joinedMessages, /Running run_remote_labeling\.\.\./);
  assert.match(joinedMessages, /Starting remote run for econ-housing-cycle\.\.\./);
  assert.match(joinedMessages, /Regression summary/);
  assert.match(joinedMessages, /Permit sensitivity by income-growth quartile/);
  assert.match(joinedMessages, /Hypothesis report\.md/);
});

test("uploaded dataset deployment flow uses user-facing stage updates and upload progress", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "research-upload-"));
  const datasetPath = join(tempDir, "Enriched Tweets.csv");
  await writeFile(datasetPath, "tweet_id,full_text\n1,hello world\n2,hello again\n", "utf8");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 200 });

  try {
    const fakeClient = {
      async respond(body: Record<string, unknown>) {
        if (Array.isArray(body.input)) {
          return {
            sessionId: "terminal-session-upload",
            payload: {
              id: "response-upload-2",
              output_text: "Dataset created and deployment started.",
              output: [{
                type: "message",
                content: [{ type: "output_text", text: "Dataset created and deployment started." }],
              }],
            },
          };
        }
        return {
          sessionId: "terminal-session-upload",
          payload: {
            id: "response-upload-1",
            output: [
              { type: "function_call", call_id: "call-1", name: "resolve_local_dataset", arguments: JSON.stringify({ hint: `"${datasetPath}"` }) },
              { type: "function_call", call_id: "call-2", name: "profile_local_dataset", arguments: JSON.stringify({ inputPath: datasetPath }) },
              { type: "function_call", call_id: "call-3", name: "register_remote_dataset", arguments: JSON.stringify({ datasetId: "enriched-tweets", name: "Enriched Tweets", inputPath: datasetPath, mode: "tabular" }) },
              { type: "function_call", call_id: "call-4", name: "request_dataset_source_upload", arguments: JSON.stringify({ datasetId: "enriched-tweets", inputPath: datasetPath }) },
              { type: "function_call", call_id: "call-5", name: "upload_local_file", arguments: JSON.stringify({ inputPath: datasetPath, uploadUrl: "https://upload.example.test/object" }) },
              { type: "function_call", call_id: "call-6", name: "complete_dataset_source_upload", arguments: JSON.stringify({ datasetId: "enriched-tweets" }) },
              { type: "function_call", call_id: "call-7", name: "deploy_remote_dataset", arguments: JSON.stringify({ datasetId: "enriched-tweets" }) },
            ],
          },
        };
      },
      async createDataset() {
        return { dataset: { id: "enriched-tweets", name: "Enriched Tweets", status: "created" } };
      },
      async requestDatasetSourceUpload() {
        return { upload: { method: "PUT", url: "https://upload.example.test/object", key: "uploads/enriched-tweets.csv" } };
      },
      async completeDatasetSourceUpload() {
        return { ok: true };
      },
      async deployDataset() {
        return {
          deployment: { datasetId: "enriched-tweets", status: "booting" },
          run: {
            id: "run-deploy",
            datasetId: "enriched-tweets",
            status: "booting",
            prompt: "Deploy dataset",
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-01T00:00:00.000Z",
          },
        };
      },
      async appendSessionEntry() {
        return { id: "entry-upload" };
      },
    };
    const deps: AgentRuntimeDeps = {
      ...createDefaultAgentRuntimeDeps(),
      createRemoteClient: () => fakeClient as never,
      readSession: async () => session,
    };
    const { messages, emit } = collect();

    await runAgentTurn(
      `Create a dataset from "${datasetPath}". It contains tweets, authors, timestamps, text, and engagement counts. Name it Enriched Tweets and deploy it.`,
      session,
      emit,
      undefined,
      deps,
    );

    const joinedMessages = messages.map((message) => message.content).join("\n");
    assert.match(joinedMessages, new RegExp(`Using local file ${datasetPath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`));
    assert.match(joinedMessages, /Inspecting Enriched Tweets\.csv/);
    assert.match(joinedMessages, /Checked the file structure for Enriched Tweets\.csv/);
    assert.match(joinedMessages, /Created dataset Enriched Tweets \(dataset id: enriched-tweets\)\./);
    assert.match(joinedMessages, /Upload target ready for Enriched Tweets\.csv\./);
    assert.match(joinedMessages, /Upload progress: 100%/);
    assert.match(joinedMessages, /Finished uploading Enriched Tweets\.csv\./);
    assert.match(joinedMessages, /Source upload verified for dataset enriched-tweets\./);
    assert.match(joinedMessages, /Deployment started for dataset enriched-tweets\. Run: run-deploy\. Status: booting\./);
    assert.match(joinedMessages, /Terminal session: https:\/\/dashboard\.alpharesearch\.nyc\/\?view=terminal-sessions&sessionId=terminal-session-upload&runId=run-deploy#run-run-deploy/);
    assert.doesNotMatch(joinedMessages, /profile_local_dataset|Registered remote dataset/);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true, force: true });
  }
});
