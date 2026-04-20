import { access, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import { DEFAULT_INSTANCE_ROOT, type SessionRecord } from "./config.js";
import { inferDatasetDefaults, inferDatasetIngestFlags, requireRemoteClient, uploadFileToPresignedUrl } from "./local-tools.js";
import { getInstanceBootstrap, listInstanceBundles } from "@alpha-datasets/storage";
import { login, readSession } from "./session.js";
import { readTrackedRuns, trackRemoteRun } from "./runs.js";

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
  | { type: "listTrackedRuns" }
  | { type: "ingestAndDeploy"; input: string; mode?: "auto" | "tabular" | "unstructured"; name?: string; datasetId?: string; instanceId?: string }
  | { type: "deployInstance"; instanceId: string; datasetId?: string }
  | { type: "startRun"; datasetId: string; prompt: string };

type PlannerPayload = {
  action: AgentAction;
};

const DATASET_EXTENSIONS = [".parquet", ".csv", ".json", ".txt", ".md", ".markdown", ".html", ".htm", ".pdf"];

async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function inferLocalDatasetPath(input: string): Promise<string | null> {
  const lower = input.toLowerCase();
  const quotedPathMatch = input.match(/"([^"]+\.(parquet|csv|json|txt|md|markdown|html|htm|pdf))"/iu);
  if (quotedPathMatch?.[1]) {
    return quotedPathMatch[1];
  }

  const explicitFilenameMatch = input.match(/([A-Za-z0-9 _-]+\.(parquet|csv|json|txt|md|markdown|html|htm|pdf))/iu);
  if (explicitFilenameMatch?.[1]) {
    const explicitName = explicitFilenameMatch[1].trim();
    const candidates = [
      explicitName,
      join(homedir(), "Downloads", explicitName),
      join(homedir(), "Desktop", explicitName),
    ];
    for (const candidate of candidates) {
      if (await fileExists(candidate)) {
        return candidate;
      }
    }
  }

  const mentionsDownloads = /downloads?/.test(lower);
  const mentionsDesktop = /desktop/.test(lower);
  const directory = mentionsDesktop ? join(homedir(), "Desktop") : join(homedir(), "Downloads");
  const wantsDataset = /dataset|file|parquet|csv|json|pdf|tweets?|text/.test(lower);
  if (!wantsDataset) {
    return null;
  }

  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => DATASET_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension)));

    if (files.length === 0) {
      return null;
    }

    const scored = files
      .map((name) => {
        let score = 0;
        const normalized = name.toLowerCase();
        if (lower.includes("tweet") && normalized.includes("tweet")) score += 5;
        if (lower.includes("parquet") && normalized.endsWith(".parquet")) score += 4;
        if (lower.includes("enriched") && normalized.includes("enriched")) score += 3;
        if (mentionsDownloads) score += 1;
        return { name, score };
      })
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

    const best = scored[0];
    if (!best || best.score <= 0 && lower.includes("tweet")) {
      return null;
    }
    return join(directory, best.name);
  } catch {
    return null;
  }
}

async function heuristicPlan(input: string, hasSession: boolean): Promise<AgentAction> {
  const lower = input.toLowerCase();
  if (/sign in|login|log in/.test(lower)) {
    return { type: "login" };
  }
  if (/list .*remote|show .*remote|remote datasets/.test(lower)) {
    return hasSession ? { type: "listRemoteDatasets" } : { type: "login" };
  }
  if (/show .*runs|list .*runs|in progress runs|active runs|tracked runs/.test(lower)) {
    return { type: "listTrackedRuns" };
  }
  if (/list .*local|show .*instances|local datasets/.test(lower)) {
    return { type: "listLocalDatasets" };
  }
  if (/start run|kickoff run|run a query/.test(lower)) {
    return { type: "question", question: "Which remote dataset should I run against, and what prompt should I send?" };
  }

  const inferredPath = await inferLocalDatasetPath(input);
  if (/create|ingest|deploy|make me a dataset|make a dataset/.test(lower) && inferredPath) {
    const inputPath = inferredPath;
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

async function postProcessAction(input: string, hasSession: boolean, action: AgentAction): Promise<AgentAction> {
  if (action.type !== "reply" && action.type !== "question") {
    return action;
  }
  const lower = input.toLowerCase();
  const inferredPath = await inferLocalDatasetPath(input);
  if (/create|ingest|deploy|make me a dataset|make a dataset/.test(lower) && inferredPath) {
    const defaults = inferDatasetDefaults(inferredPath);
    return {
      type: hasSession ? "ingestAndDeploy" : "login",
      input: inferredPath,
      mode: inferredPath.endsWith(".parquet") || inferredPath.endsWith(".csv") || inferredPath.endsWith(".json") ? "tabular" : "unstructured",
      name: defaults.name,
      datasetId: defaults.datasetId,
      instanceId: defaults.id,
    };
  }
  return action;
}

export async function planAction(input: string, session: SessionRecord | null): Promise<AgentAction> {
  if (!session) {
    return heuristicPlan(input, Boolean(session));
  }

  try {
    const client = await requireRemoteClient();
    const payload = await client.planAction(input);
    const parsed = payload as PlannerPayload;
    return postProcessAction(input, Boolean(session), parsed.action);
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
    case "listTrackedRuns": {
      const runs = await readTrackedRuns();
      emit({
        role: "assistant",
        content: runs.length > 0
          ? `Tracked runs:\n${runs.map((item) => `- ${item.id} (${item.datasetId}, ${item.status})`).join("\n")}`
          : "No tracked runs yet.",
      });
      return;
    }
    case "ingestAndDeploy": {
      const defaults = inferDatasetDefaults(action.input);
      const inferredFlags = inferDatasetIngestFlags(action.input);
      const instanceId = action.instanceId ?? defaults.id;
      const datasetId = action.datasetId ?? defaults.datasetId;
      const name = action.name ?? defaults.name;
      const client = await requireRemoteClient();
      emit({ role: "tool", content: `Registering remote dataset ${datasetId}` });
      await client.createDataset({
        name,
        datasetId,
        sourceType: "uploaded_source",
        sourceFilename: basename(action.input),
        mode: action.mode ?? "auto",
        description: `Uploaded from ${action.input}`,
        ingestConfig: {
          ...(inferredFlags?.entityType ? { entityType: inferredFlags.entityType } : {}),
          ...(inferredFlags?.titleField ? { titleField: inferredFlags.titleField } : {}),
          ...(inferredFlags?.summaryField ? { summaryField: inferredFlags.summaryField } : {}),
          ...(inferredFlags?.textFields ? { textFields: inferredFlags.textFields } : {}),
          ...(inferredFlags?.dateField ? { dateField: inferredFlags.dateField } : {}),
        },
      });
      emit({ role: "tool", content: `Requesting upload target for ${basename(action.input)}` });
      const upload = await client.requestDatasetSourceUpload(datasetId, {
        filename: basename(action.input),
      });
      const sizeBytes = await uploadFileToPresignedUrl(action.input, upload.upload.url, (message) => emit({ role: "tool", content: message }));
      await client.completeDatasetSourceUpload(datasetId, { sizeBytes });
      emit({ role: "tool", content: `Deploying remote dataset ${datasetId} to DigitalOcean` });
      const deployment = await client.deployDataset(datasetId);
      emit({
        role: "assistant",
        content: `Created and deployed ${datasetId}. Deployment status: ${deployment.deployment.status}${deployment.deployment.volume ? ` on volume ${deployment.deployment.volume.name}` : ""}.`,
      });
      if (deployment.run) {
        const session = await readSession();
        if (session) {
          await trackRemoteRun({
            id: deployment.run.id,
            datasetId: deployment.run.datasetId,
            origin: session.origin,
            status: deployment.run.status,
            prompt: deployment.run.prompt,
            createdAt: deployment.run.createdAt,
            updatedAt: deployment.run.updatedAt,
          });
        }
        emit({ role: "tool", content: `Tracking deploy run ${deployment.run.id}` });
      }
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
      const session = await readSession();
      if (session) {
        await trackRemoteRun({
          id: result.run.id,
          datasetId: result.run.datasetId,
          origin: session.origin,
          status: result.run.status,
          prompt: result.run.prompt ?? action.prompt,
          createdAt: result.run.createdAt,
          updatedAt: result.run.updatedAt,
        });
      }
      emit({
        role: "assistant",
        content: `Started run ${result.run.id} on ${action.datasetId} with status ${result.run.status}. RESEARCH will keep tracking it.`,
      });
      return;
    }
  }
}

export async function ensureSessionForInteractive(): Promise<SessionRecord | null> {
  return readSession();
}
