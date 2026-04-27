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
