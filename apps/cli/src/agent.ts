import OpenAI from "openai";

import { DEFAULT_AGENT_MODEL, DEFAULT_INSTANCE_ROOT, type SessionRecord } from "./config.js";
import { inferDatasetDefaults, requireRemoteClient, runIngest } from "./local-tools.js";
import { getInstanceBootstrap, listInstanceBundles } from "@alpha-datasets/storage";
import { login, readSession } from "./session.js";

export type AgentMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type AgentToolResult = {
  summary: string;
  data?: unknown;
};

export type AgentAction =
  | { type: "reply"; message: string }
  | { type: "question"; question: string }
  | { type: "login" }
  | { type: "listLocalDatasets" }
  | { type: "listRemoteDatasets" }
  | { type: "ingestAndDeploy"; input: string; mode?: "auto" | "tabular" | "unstructured"; name?: string; datasetId?: string; instanceId?: string }
  | { type: "deployInstance"; instanceId: string; datasetId?: string }
  | { type: "startRun"; datasetId: string; prompt: string };

type PlannerPayload = {
  action: AgentAction;
};

function createPlannerPrompt(input: string, hasSession: boolean): string {
  return [
    "You are the RESEARCH CLI planner.",
    "Pick exactly one action for the user's request.",
    "Prefer concrete actions over commentary.",
    "If the user asks to create a dataset from a file path, choose ingestAndDeploy.",
    "If sign-in is required and missing, choose login.",
    "If information is missing that you need to continue, choose question.",
    `The user is ${hasSession ? "" : "not "}signed in.`,
    "",
    "Return JSON only with this shape:",
    '{"action":{"type":"reply|question|login|listLocalDatasets|listRemoteDatasets|ingestAndDeploy|deployInstance|startRun", "...": "..."}}',
    "",
    `User request: ${input}`,
  ].join("\n");
}

function heuristicPlan(input: string, hasSession: boolean): AgentAction {
  const lower = input.toLowerCase();
  if (/sign in|login|log in/.test(lower)) {
    return { type: "login" };
  }
  if (/list .*remote|show .*remote|remote datasets/.test(lower)) {
    return hasSession ? { type: "listRemoteDatasets" } : { type: "login" };
  }
  if (/list .*local|show .*instances|local datasets/.test(lower)) {
    return { type: "listLocalDatasets" };
  }
  if (/start run|kickoff run|run a query/.test(lower)) {
    return { type: "question", question: "Which remote dataset should I run against, and what prompt should I send?" };
  }

  const quotedPathMatch = input.match(/"([^"]+\.(parquet|csv|json|txt|md|markdown|html|htm|pdf))"/iu);
  if (/create|ingest|deploy/.test(lower) && quotedPathMatch) {
    const inputPath = quotedPathMatch[1]!;
    const defaults = inferDatasetDefaults(inputPath);
    return {
      type: hasSession ? "ingestAndDeploy" : "login",
      input: inputPath,
      mode: inputPath.endsWith(".parquet") || inputPath.endsWith(".csv") || inputPath.endsWith(".json") ? "tabular" : "unstructured",
      name: defaults.name,
      datasetId: defaults.datasetId,
      instanceId: defaults.id,
    } as AgentAction;
  }

  return {
    type: "reply",
    message: "I can sign in, create datasets from local files, deploy them, list remote datasets, and start remote runs. Tell me what dataset file to use or what remote dataset you want to operate on.",
  };
}

export async function planAction(input: string, session: SessionRecord | null): Promise<AgentAction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return heuristicPlan(input, Boolean(session));
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: DEFAULT_AGENT_MODEL,
      input: createPlannerPrompt(input, Boolean(session)),
    });
    const text = response.output_text.trim();
    const parsed = JSON.parse(text) as PlannerPayload;
    return parsed.action;
  } catch {
    return heuristicPlan(input, Boolean(session));
  }
}

export async function executeAction(
  action: AgentAction,
  emit: (message: AgentMessage) => void,
): Promise<void> {
  switch (action.type) {
    case "reply":
      emit({ role: "assistant", content: action.message });
      return;
    case "question":
      emit({ role: "assistant", content: action.question });
      return;
    case "login": {
      const session = await login({}, (message) => emit({ role: "tool", content: message }));
      emit({ role: "assistant", content: `Signed in to ${session.origin}.` });
      return;
    }
    case "listLocalDatasets": {
      const payload = await listInstanceBundles(DEFAULT_INSTANCE_ROOT);
      emit({
        role: "assistant",
        content: payload.length > 0
          ? `Local datasets:\n${payload.map((item) => `- ${item.id} (${item.recordCount.toLocaleString()} records, ${item.layout})`).join("\n")}`
          : "No local datasets found.",
      });
      return;
    }
    case "listRemoteDatasets": {
      const client = await requireRemoteClient();
      const payload = await client.listDatasets();
      emit({
        role: "assistant",
        content: payload.datasets.length > 0
          ? `Remote datasets:\n${payload.datasets.map((item) => `- ${item.id} (${item.deploymentStatus ?? item.status ?? "unknown"})`).join("\n")}`
          : "No remote datasets found.",
      });
      return;
    }
    case "ingestAndDeploy": {
      const defaults = inferDatasetDefaults(action.input);
      const instanceId = action.instanceId ?? defaults.id;
      const datasetId = action.datasetId ?? defaults.datasetId;
      const name = action.name ?? defaults.name;
      emit({ role: "tool", content: `Creating local dataset package for ${action.input}` });
      await runIngest([
        "--mode", action.mode ?? "auto",
        "--input", action.input,
        "--id", instanceId,
        "--name", name,
        "--dataset-id", datasetId,
      ], (message) => emit({ role: "tool", content: message }));

      const bootstrap = await getInstanceBootstrap(DEFAULT_INSTANCE_ROOT, instanceId);
      const client = await requireRemoteClient();
      emit({ role: "tool", content: `Registering remote dataset ${datasetId}` });
      await client.createDataset({
        name,
        datasetId,
        sourceType: "local_instance",
        instanceId,
        manifestPath: `${DEFAULT_INSTANCE_ROOT}/${instanceId}/manifest.json`,
        description: bootstrap.descriptor.description,
      });
      emit({ role: "tool", content: `Deploying remote dataset ${datasetId}` });
      const deployment = await client.deployDataset(datasetId);
      emit({
        role: "assistant",
        content: `Created and deployed ${datasetId}. Deployment status: ${deployment.deployment.status}${deployment.deployment.url ? ` (${deployment.deployment.url})` : ""}.`,
      });
      return;
    }
    case "deployInstance": {
      const client = await requireRemoteClient();
      const bootstrap = await getInstanceBootstrap(DEFAULT_INSTANCE_ROOT, action.instanceId);
      const datasetId = action.datasetId ?? bootstrap.descriptor.id;
      await client.createDataset({
        name: bootstrap.implementation.productName,
        datasetId,
        sourceType: "local_instance",
        instanceId: action.instanceId,
        manifestPath: `${DEFAULT_INSTANCE_ROOT}/${action.instanceId}/manifest.json`,
        description: bootstrap.descriptor.description,
      });
      const deployment = await client.deployDataset(datasetId);
      emit({
        role: "assistant",
        content: `Deployment started for ${datasetId}: ${deployment.deployment.status}`,
      });
      return;
    }
    case "startRun": {
      const client = await requireRemoteClient();
      const result = await client.startRun(action.datasetId, action.prompt);
      emit({
        role: "assistant",
        content: `Started run ${result.run.id} on ${action.datasetId} with status ${result.run.status}.`,
      });
      return;
    }
  }
}

export async function ensureSessionForInteractive(): Promise<SessionRecord | null> {
  return readSession();
}
