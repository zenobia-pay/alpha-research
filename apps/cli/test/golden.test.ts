import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import {
  createDefaultAgentRuntimeDeps,
  runAgentTurn,
  type AgentMessage,
  type AgentRuntimeDeps,
} from "../src/agent.js";
import type { RemoteDatasetSummary, RemoteRunSummary } from "../src/remote.js";

type GoldenFixture = {
  name: string;
  prompt: string;
  response: Record<string, unknown>;
  datasets?: RemoteDatasetSummary[];
  run?: RemoteRunSummary;
  results?: {
    run: RemoteRunSummary;
    metadata?: { artifactSpec?: unknown };
    events: Array<{ id: string; runId: string; message: string }>;
    artifacts: Array<{ id: string; runId: string; type: string; title: string; content?: unknown }>;
  };
  expectedToolCalls: string[];
  expectedSummaryIncludes: string[];
};

const session = {
  origin: "https://alpharesearch.nyc",
  accessToken: "test-token",
  createdAt: "2026-04-22T00:00:00.000Z",
};

async function readFixtures() {
  const root = join(import.meta.dirname, "golden");
  const files = (await readdir(root)).filter((file) => file.endsWith(".json"));
  return Promise.all(files.map(async (file) => {
    const raw = await readFile(join(root, file), "utf8");
    return JSON.parse(raw) as GoldenFixture;
  }));
}

for (const fixture of await readFixtures()) {
  test(`golden: ${fixture.name}`, async () => {
    const toolCalls: string[] = [];
    const messages: AgentMessage[] = [];
    const fakeClient = {
      async respond(body: Record<string, unknown>) {
        if (Array.isArray(body.input)) {
          return {
            sessionId: "golden-session",
            payload: {
              id: "golden-final",
              output_text: "Done.",
              output: [{ type: "message", content: [{ type: "output_text", text: "Done." }] }],
            },
          };
        }
        return {
          sessionId: "golden-session",
          payload: fixture.response,
        };
      },
      async appendSessionEntry() {
        return { id: "entry-1" };
      },
      async listDatasets() {
        toolCalls.push("list_remote_datasets");
        return { datasets: fixture.datasets ?? [] };
      },
      async createDataset() {
        return { dataset: { id: "dataset", name: "Dataset", status: "draft" } };
      },
      async createResearchEnvironment() {
        toolCalls.push("create_research_environment");
        return {
          dataset: null,
          environment: { datasetId: fixture.run?.datasetId ?? "dataset", status: "booting" },
          run: fixture.run ?? {
            id: "run-1",
            datasetId: "dataset",
            status: "booting",
          },
        };
      },
      async createPublicDataEnvironment() {
        toolCalls.push("create_public_data_environment");
        return {
          dataset: null,
          environment: { datasetId: fixture.run?.datasetId ?? "public-dataset", status: "booting" },
          run: fixture.run ?? {
            id: "run-public",
            datasetId: "public-dataset",
            status: "booting",
            prompt: "Fetch public data.",
          },
        };
      },
      async startRun() {
        toolCalls.push("start_research_run");
        return {
          run: fixture.run ?? {
            id: "run-query",
            datasetId: "dataset",
            status: "booting",
            prompt: "Run query.",
          },
        };
      },
      async getRunResults() {
        toolCalls.push("get_run_results");
        return fixture.results ?? {
          run: fixture.run ?? {
            id: "run-results",
            datasetId: "dataset",
            status: "ready",
            prompt: "Summarize the run.",
          },
          metadata: { artifactSpec: [{ type: "json", title: "Result JSON" }] },
          events: [{ id: "evt-1", runId: "run-results", message: "Run completed." }],
          artifacts: [{
            id: "artifact-1",
            runId: "run-results",
            type: "structured_result",
            title: "result.json",
            content: { total_rows: 10, distinct_tweet_ids: 10 },
          }],
        };
      },
      async cancelRun() {
        toolCalls.push("cancel_remote_run");
        return {
          run: fixture.run ?? {
            id: "run-cancel",
            datasetId: "dataset",
            status: "cancelled",
            prompt: "Stop this run.",
          },
        };
      },
    };
    const deps: AgentRuntimeDeps = {
      ...createDefaultAgentRuntimeDeps(),
      createRemoteClient: () => fakeClient as never,
      readSession: async () => session,
    };

    await runAgentTurn(fixture.prompt, session, (message) => messages.push(message), undefined, deps);

    assert.deepEqual(toolCalls, fixture.expectedToolCalls);
    const joined = messages.map((message) => message.content).join("\n");
    for (const expected of fixture.expectedSummaryIncludes) {
      assert.match(joined, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")));
    }
  });
}
