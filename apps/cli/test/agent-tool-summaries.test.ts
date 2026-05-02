import assert from "node:assert/strict";
import test from "node:test";

import { createToolRegistry, type AgentMessage, type AgentRuntimeDeps, type ToolExecutionContext } from "../src/agent.js";

const session = {
  origin: "https://alpharesearch.nyc",
  accessToken: "test-token",
  createdAt: "2026-04-22T00:00:00.000Z",
};

function makeDeps(overrides: Partial<AgentRuntimeDeps> = {}): AgentRuntimeDeps {
  return {
    createRemoteClient: () => {
      throw new Error("createRemoteClient override required");
    },
    readSession: async () => session,
    login: async () => session,
    createToolRegistry,
    readTrackedRuns: async () => [],
    now: () => Date.now(),
    listLocalDatasets: async () => [],
    ...overrides,
  };
}

function collectMessages() {
  const messages: AgentMessage[] = [];
  return {
    messages,
    emit: (message: AgentMessage) => {
      messages.push(message);
    },
  };
}

test("list_remote_datasets shortlist hides zero-signal matches for focused build prompts", async () => {
  const tool = createToolRegistry().find((entry) => entry.name === "list_remote_datasets");
  assert.ok(tool);
  const deps = makeDeps({
    createRemoteClient: () => ({
      async listDatasets() {
        return {
          datasets: [
            { id: "econ", name: "Economics", status: "ready", deploymentStatus: "ready" },
            { id: "mixed-smoke-1776979192", name: "Mixed Smoke", status: "ready", deploymentStatus: "ready" },
            { id: "history", name: "History", status: "deploying", deploymentStatus: "deploying" },
            { id: "philosophy", name: "Philosophy", status: "deploying", deploymentStatus: "deploying" },
          ],
        };
      },
    }) as never,
  });
  const { emit } = collectMessages();
  const context: ToolExecutionContext = {
    session,
    sessionId: "session-1",
    emit,
    deps,
  };

  const result = await tool.execute(context, { topic: "housing", limit: 5 });

  assert.match(result.summary, /Top matches for "housing":/);
  assert.match(result.summary, /econ \(ready, score 3\) — matching topic terms: housing/);
  assert.doesNotMatch(result.summary, /mixed-smoke-1776979192/);
  assert.doesNotMatch(result.summary, /history/);
  assert.doesNotMatch(result.summary, /philosophy/);
});

test("create_research_environment summary gives a durable async handoff", async () => {
  const tool = createToolRegistry().find((entry) => entry.name === "create_research_environment");
  assert.ok(tool);
  const deps = makeDeps({
    createRemoteClient: () => ({
      async listDatasets() {
        return {
          datasets: [
            { id: "econ", name: "Economics", status: "ready", deploymentStatus: "ready" },
          ],
        };
      },
      async createResearchEnvironment(datasetId: string) {
        return {
          dataset: null,
          environment: { datasetId, status: "booting" },
          run: {
            id: "run-econ-build",
            datasetId,
            status: "booting",
            prompt: "Build the housing-cycle economics environment.",
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-01T00:00:05.000Z",
          },
        };
      },
    }) as never,
  });
  const { messages, emit } = collectMessages();
  const context: ToolExecutionContext = {
    session,
    sessionId: "session-1",
    emit,
    deps,
  };

  const result = await tool.execute(context, {
    datasetId: "econ-housing-cycle",
    name: "Housing-cycle economics panel",
    prompt: "Fetch, stage, normalize, validate, and document a county-month housing-cycle dataset. Validate source URLs, row counts, missingness, join keys, temporal coverage, and produce a data dictionary and manifest.",
    artifacts: [
      { type: "manifest", title: "Dataset manifest" },
      { type: "markdown", title: "Validation report" },
    ],
  });

  assert.match(messages.map((message) => message.content).join("\n"), /Best existing base: Economics \(econ\)\./);
  assert.match(result.summary, /Dataset: econ/);
  assert.match(result.summary, /Run: run-econ-build/);
  assert.match(result.summary, /State: starting\. The backend worker is still initializing\./);
  assert.match(result.summary, /Validation preserved: source URLs, row counts, missingness, join keys, temporal coverage\./);
  assert.match(result.summary, /Expected artifacts: Dataset manifest; Validation report; Data dictionary; Manifest/);
  assert.match(result.summary, /The build launched and will keep running in the background\./);
  assert.match(result.summary, /research debug run run-econ-build/);
});
