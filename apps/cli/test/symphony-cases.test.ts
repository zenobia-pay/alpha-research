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
import type { RemoteDatasetSummary, RemoteRunArtifact, RemoteRunEvent, RemoteRunSummary } from "../src/remote.js";

type SymphonyToolCall = {
  name: string;
  arguments?: Record<string, unknown>;
};

type SymphonyCase = {
  name: string;
  prompt: string;
  description?: string;
  remote?: {
    datasets?: RemoteDatasetSummary[];
    createResearchEnvironmentRun?: RemoteRunSummary;
    createPublicDataEnvironmentRun?: RemoteRunSummary;
    startRun?: RemoteRunSummary;
    runResults?: {
      run: RemoteRunSummary;
      metadata?: { artifactSpec?: unknown };
      events?: RemoteRunEvent[];
      artifacts?: RemoteRunArtifact[];
    };
  };
  modelRounds: Array<{
    toolCalls?: SymphonyToolCall[];
    assistant?: string;
  }>;
  expected: {
    toolCalls?: string[];
    forbiddenToolCalls?: string[];
    assistantIncludes?: string[];
    createdDataset?: {
      datasetId: string;
      sourceType?: string;
    };
    startedRun?: {
      datasetId?: string;
      type?: string;
    };
    researchEnvironmentPromptIncludes?: string[];
    researchEnvironmentSourcesInclude?: string[];
  };
};

type RecordedCall = {
  name: string;
  args: unknown[];
};

const session = {
  origin: "https://alpharesearch.nyc",
  accessToken: "test-token",
  createdAt: "2026-04-22T00:00:00.000Z",
};

async function readCases() {
  const root = join(import.meta.dirname, "symphony-cases");
  const files = (await readdir(root)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => {
    const raw = await readFile(join(root, file), "utf8");
    return JSON.parse(raw) as SymphonyCase;
  }));
}

function responsesPayloadForRound(index: number, round: SymphonyCase["modelRounds"][number]) {
  if (round.toolCalls?.length) {
    return {
      id: `symphony-response-${index}`,
      output: round.toolCalls.map((call, callIndex) => ({
        type: "function_call",
        call_id: `call-${index}-${callIndex}`,
        name: call.name,
        arguments: JSON.stringify(call.arguments ?? {}),
      })),
    };
  }
  const text = round.assistant ?? "Done.";
  return {
    id: `symphony-response-${index}`,
    output_text: text,
    output: [{ type: "message", content: [{ type: "output_text", text }] }],
  };
}

function createFakeClient(fixture: SymphonyCase, recorded: RecordedCall[]) {
  let responseIndex = 0;
  const runResults = fixture.remote?.runResults ?? {
    run: fixture.remote?.startRun ?? {
      id: "run-symphony-results",
      datasetId: "dataset",
      status: "ready",
      prompt: "Synthetic run result.",
    },
    metadata: { artifactSpec: [] },
    events: [],
    artifacts: [],
  };

  return {
    async respond() {
      const round = fixture.modelRounds[responseIndex] ?? { assistant: "Done." };
      const payload = responsesPayloadForRound(responseIndex, round);
      responseIndex += 1;
      return { sessionId: "symphony-test-session", payload };
    },
    async appendSessionEntry() {
      return { id: "entry-1" };
    },
    async listDatasets() {
      recorded.push({ name: "listDatasets", args: [] });
      return { datasets: fixture.remote?.datasets ?? [] };
    },
    async createDataset(body: Record<string, unknown>) {
      recorded.push({ name: "createDataset", args: [body] });
      return {
        dataset: {
          id: String(body.datasetId ?? "dataset"),
          name: String(body.name ?? "Dataset"),
          status: "draft",
        },
      };
    },
    async createResearchEnvironment(datasetId: string, body: Record<string, unknown>) {
      recorded.push({ name: "createResearchEnvironment", args: [datasetId, body] });
      return {
        dataset: null,
        environment: { datasetId, status: "booting" },
        run: fixture.remote?.createResearchEnvironmentRun ?? {
          id: "run-research-environment",
          datasetId,
          status: "booting",
          prompt: typeof body.prompt === "string" ? body.prompt : "Build research environment.",
        },
      };
    },
    async createPublicDataEnvironment(datasetId: string, body: Record<string, unknown>) {
      recorded.push({ name: "createPublicDataEnvironment", args: [datasetId, body] });
      return {
        dataset: null,
        environment: { datasetId, status: "booting" },
        run: fixture.remote?.createPublicDataEnvironmentRun ?? {
          id: "run-public-data",
          datasetId,
          status: "booting",
          prompt: typeof body.prompt === "string" ? body.prompt : "Build public data environment.",
        },
      };
    },
    async startRun(datasetId: string, prompt: string, config: Record<string, unknown>) {
      recorded.push({ name: "startRun", args: [datasetId, prompt, config] });
      return {
        run: fixture.remote?.startRun ?? {
          id: "run-started",
          datasetId,
          status: "booting",
          prompt,
        },
      };
    },
    async getRun() {
      recorded.push({ name: "getRun", args: [] });
      return { run: runResults.run };
    },
    async getRunEvents() {
      recorded.push({ name: "getRunEvents", args: [] });
      return { events: runResults.events ?? [] };
    },
    async getRunResults() {
      recorded.push({ name: "getRunResults", args: [] });
      return {
        run: runResults.run,
        metadata: runResults.metadata ?? { artifactSpec: [] },
        events: runResults.events ?? [],
        artifacts: runResults.artifacts ?? [],
      };
    },
    async getRunArtifacts() {
      recorded.push({ name: "getRunArtifacts", args: [] });
      return {
        run: runResults.run,
        artifacts: runResults.artifacts ?? [],
      };
    },
    async cancelRun(runId: string) {
      recorded.push({ name: "cancelRun", args: [runId] });
      return { run: { ...runResults.run, id: runId, status: "cancelled" } };
    },
  };
}

function emittedToolCalls(messages: AgentMessage[]) {
  return messages.flatMap((message) => {
    if (message.role !== "tool") return [];
    const calling = message.content.match(/^Calling ([a-z0-9_]+)$/u);
    if (calling) return [calling[1]];
    if (message.content.startsWith("Checking remote datasets")) return ["list_remote_datasets"];
    if (message.content.startsWith("Starting dataset build")) return ["create_research_environment"];
    if (message.content.startsWith("Inspecting dataset")) return ["inspect_remote_dataset"];
    if (message.content.startsWith("Starting remote run")) return ["start_remote_run"];
    return [];
  });
}

function assertIncludes(haystack: string, needles: string[] | undefined, label: string) {
  for (const needle of needles ?? []) {
    assert.match(haystack, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), `${label} should include ${needle}`);
  }
}

for (const fixture of await readCases()) {
  test(`symphony case: ${fixture.name}`, async () => {
    const messages: AgentMessage[] = [];
    const recorded: RecordedCall[] = [];
    const fakeClient = createFakeClient(fixture, recorded);
    const deps: AgentRuntimeDeps = {
      ...createDefaultAgentRuntimeDeps(),
      createRemoteClient: () => fakeClient as never,
      readSession: async () => session,
    };

    await runAgentTurn(fixture.prompt, session, (message) => messages.push(message), undefined, deps);

    const toolCalls = emittedToolCalls(messages);
    assert.deepEqual(toolCalls, fixture.expected.toolCalls ?? []);
    for (const forbidden of fixture.expected.forbiddenToolCalls ?? []) {
      assert.equal(toolCalls.includes(forbidden), false, `Unexpected tool call ${forbidden}`);
    }

    const joinedMessages = messages.map((message) => message.content).join("\n");
    assertIncludes(joinedMessages, fixture.expected.assistantIncludes, "assistant transcript");

    if (fixture.expected.createdDataset) {
      const createDataset = recorded.find((call) => call.name === "createDataset");
      assert.ok(createDataset, "Expected createDataset remote call");
      const body = createDataset.args[0] as Record<string, unknown>;
      assert.equal(body.datasetId, fixture.expected.createdDataset.datasetId);
      if (fixture.expected.createdDataset.sourceType) {
        assert.equal(body.sourceType, fixture.expected.createdDataset.sourceType);
      }
    }

    const researchEnvironment = recorded.find((call) => call.name === "createResearchEnvironment");
    if (fixture.expected.researchEnvironmentPromptIncludes) {
      assert.ok(researchEnvironment, "Expected createResearchEnvironment remote call");
      const body = researchEnvironment.args[1] as Record<string, unknown>;
      assertIncludes(String(body.prompt ?? ""), fixture.expected.researchEnvironmentPromptIncludes, "research environment prompt");
    }
    if (fixture.expected.researchEnvironmentSourcesInclude) {
      assert.ok(researchEnvironment, "Expected createResearchEnvironment remote call");
      const body = researchEnvironment.args[1] as Record<string, unknown>;
      assertIncludes(JSON.stringify(body.publicSources ?? []), fixture.expected.researchEnvironmentSourcesInclude, "research environment sources");
    }

    if (fixture.expected.startedRun) {
      const startRun = recorded.find((call) => call.name === "startRun");
      assert.ok(startRun, "Expected startRun remote call");
      if (fixture.expected.startedRun.datasetId) {
        assert.equal(startRun.args[0], fixture.expected.startedRun.datasetId);
      }
      if (fixture.expected.startedRun.type) {
        const config = startRun.args[2] as Record<string, unknown>;
        assert.equal(config.type, fixture.expected.startedRun.type);
      }
    }
  });
}
