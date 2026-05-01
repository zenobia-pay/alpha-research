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
  assert.match(final, /Create a dataset from \/absolute\/path\/customers\.csv/i);
  assert.match(final, /inspect what each one contains/i);
  assert.match(final, /Brief a dataset before you trust or analyze it/i);
  assert.match(final, /Plan or run an analysis for a specific question/i);
  assert.match(final, /latest results or saved files from earlier work/i);
  assert.match(final, /Show my latest analysis results/i);
  assert.doesNotMatch(final, /dataset-backed|artifacts|labeling jobs|experiments|last run|remote run|manifest-backed|mounted dataset|worker_unreachable|lifecycle/i);
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
  assert.match(final, /absolute path/i);
  assert.match(final, /one-line description/i);
  assert.match(final, /infer the schema/i);
  assert.match(final, /register the dataset/i);
  assert.match(final, /upload it/i);
  assert.match(final, /deploy it/i);
  assert.doesNotMatch(final, /Started|run-[a-z0-9-]+|Dashboard:/i);
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
  assert.match(final, /U\.S\. housing market/i);
  assert.match(final, /quick current-state read/i);
  assert.match(final, /deeper risk analysis/i);
  assert.match(final, /affordability/i);
  assert.match(final, /mortgage rates/i);
  assert.doesNotMatch(final, /Started|Queued|Dashboard:/i);
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
  assert.match(final, /https:\/\/dashboard\.alpharesearch\.nyc\/\?view=runs&runId=run-123#run-run-123/);
  assert.match(final, /Terminal session: https:\/\/dashboard\.alpharesearch\.nyc\/\?view=terminal-sessions&sessionId=terminal-session-1&runId=run-123#run-run-123/);
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
  assert.match(final, /Started dataset briefing run run-describe for econ/);
  assert.match(final, /Terminal session: https:\/\/dashboard\.alpharesearch\.nyc\/\?view=terminal-sessions&sessionId=terminal-session-describe&runId=run-describe#run-run-describe/);
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
  assert.match(joined, /Blocked: dataset is already busy/);
  assert.match(joined, /Active run: run-blocking/);
  assert.match(joined, /No new run was started/);
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

test("product planning: vague viral tweets request designs scoped experiment before running", async () => {
  const calls: string[] = [];
  const finalPlan = [
    "This is not precise enough to run yet: `viral` needs an operational definition and the experiment needs a fixed sample, labels, and output artifact.",
    "",
    "Here is the experiment I would run:",
    "- Dataset: enriched-tweets.",
    "- Virality definition: tweets in the top 0.1% by quote_tweet_count.",
    "- Sample: pick 100 random viral tweets from that top 0.1%, stratified by month if the timestamps support it.",
    "- Labeling: run an LLM labeling job on each tweet using the tweet text and available metadata.",
    "- Structured fields to extract: hook_type, topic, emotional_tone, controversy_level, novelty, specificity, media_or_link_presence, named_entities, audience_target, call_to_action, quote_tweet_reason, and concise_rationale.",
    "- Labeling prompt: classify why this tweet was quote-tweeted; return strict JSON with the structured fields and a one-sentence rationale grounded only in the tweet text/metadata.",
    "- Visualization: show a bar chart of hook_type frequency, stacked bars for emotional_tone by controversy_level, and a table of representative examples with labels and quote counts.",
    "- Synthesis prompt: summarize which tweet traits are overrepresented among the viral sample and which hypotheses should be tested on a larger matched control set.",
    "",
    "Does this design look good, or do you want an alternative definition like retweets/likes, a control group of non-viral tweets, or a different labeling schema?",
  ].join("\n");
  const fakeClient = {
    async respond(body: Record<string, unknown>) {
      if (Array.isArray(body.input)) {
        return {
          sessionId: "planning-session",
          payload: {
            id: "planning-final",
            output_text: finalPlan,
            output: [{ type: "message", content: [{ type: "output_text", text: finalPlan }] }],
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
  assert.match(joinedMessages, /top 0\.1% by quote\/retweet\/like engagement/i);
  assert.match(joinedMessages, /sample 100 tweets/i);
  assert.match(joinedMessages, /hook_type/i);
  assert.match(joinedMessages, /emotional_tone/i);
  assert.match(joinedMessages, /controversy_level/i);
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
  assert.match(joinedMessages, /Started research environment build run-env/);
  assert.match(joinedMessages, /Created research spec spec-housing-rates/);
  assert.match(joinedMessages, /Queued transformation run run-transform/);
  assert.match(joinedMessages, /Queued labeling run run-label/);
  assert.match(joinedMessages, /Started run run-hypothesis/);
  assert.match(joinedMessages, /Regression summary/);
  assert.match(joinedMessages, /Permit sensitivity by income-growth quartile/);
  assert.match(joinedMessages, /Hypothesis report\.md/);
});
