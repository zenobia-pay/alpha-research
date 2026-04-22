import { access, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import { getInstanceBootstrap, listInstanceBundles } from "@alpha-datasets/storage";

import { DEFAULT_INSTANCE_ROOT, DEFAULT_WEB_ORIGIN, type SessionRecord } from "./config.js";
import { inferDatasetDefaults, inferDatasetIngestFlags, uploadFileToPresignedUrl } from "./local-tools.js";
import { RemoteApiClient } from "./remote.js";
import { readSession, login } from "./session.js";
import { isTerminalRunStatus, readTrackedRuns, trackRemoteRun } from "./runs.js";

export type AgentMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

type AgentToolResult = {
  summary: string;
  data?: unknown;
};

type JsonSchema = Record<string, unknown>;

type ToolExecutionContext = {
  session: SessionRecord | null;
  emit: (message: AgentMessage) => void;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (context: ToolExecutionContext, input: Record<string, unknown>) => Promise<AgentToolResult>;
};

type ResponseFunctionCall = {
  type: "function_call";
  call_id?: string;
  name?: string;
  arguments?: string;
};

type ResponseMessage = {
  type?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

type ResponsesApiPayload = {
  id?: string;
  output_text?: string;
  output?: Array<ResponseFunctionCall | ResponseMessage | Record<string, unknown>>;
};

const DATASET_EXTENSIONS = [".parquet", ".csv", ".json", ".txt", ".md", ".markdown", ".html", ".htm", ".pdf"];
const MAX_TOOL_ROUNDS = 12;

const AGENT_INSTRUCTIONS = [
  "You are RESEARCH, a CLI agent for helping knowledge workers work faster.",
  "You help them by creating and managing remote research environments with large datasets, designing experiments, and getting the results.",
  "You manage the creation, operation, and prompting of other agents on remote cloud environments.",
  "",
  "Users will use you in two main ways.",
  "",
  "The first category is creating personal research environments.",
  "The most important thing is to get the right data into that environment.",
  "Some of it will be local, some of it will be public data on the internet, and some of it will require scripting and labeling.",
  "Once you have set up a cloud environment, feel free to prompt AI agents on that environment to help you get the data.",
  "Your goal during environment creation is to get a copy of all the data you need on there.",
  "",
  "The second category is doing research over an existing research environment.",
  "Research is driven by hypotheses.",
  "When the user wants to test a hypothesis, make sure to get enough information to decide:",
  "1. What research environment to run it on.",
  "2. Whether all the necessary data exists in that research environment.",
  "3. If not, whether to extend the research environment to get the necessary data, or alter the plan so the data we do have works.",
  "4. What subset of the dataset to use, what shape it needs to be, whether it is already structured correctly, or whether a script is needed to get the right structure.",
  "5. Whether that script involves using an LLM to label data points, and what prompt to give that LLM call.",
  "6. How to view the results of the experiment. Be precise. If there are graphs, specify the chart type and exactly what the axes are.",
  "",
  "Use the provided tools.",
  "When the user describes a local dataset vaguely, call resolve_local_dataset first.",
  "For uploaded-file deployment flows, prefer this sequence:",
  "1. resolve_local_dataset",
  "2. register_remote_dataset",
  "3. request_dataset_source_upload",
  "4. upload_local_file",
  "5. complete_dataset_source_upload",
  "6. deploy_remote_dataset",
  "Be concise. After tool work completes, summarize the result and current status.",
  "Only ask the user a question if a required tool input cannot be resolved from tools or prior results.",
].join("\n");

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
  const wantsDataset = /dataset|file|parquet|csv|json|pdf|tweets?|text|download/.test(lower);
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
    if (!best) {
      return null;
    }
    if (best.score <= 0 && lower.includes("tweet")) {
      return null;
    }
    return join(directory, best.name);
  } catch {
    return null;
  }
}

function inferModeFromPath(path: string): "tabular" | "unstructured" {
  const lower = path.toLowerCase();
  if (lower.endsWith(".parquet") || lower.endsWith(".csv") || lower.endsWith(".json")) {
    return "tabular";
  }
  return "unstructured";
}

function requireSession(context: ToolExecutionContext) {
  if (!context.session) {
    throw new Error("You need to sign in first. Run `research login`.");
  }
  return context.session;
}

function createRemoteClient(context: ToolExecutionContext) {
  return new RemoteApiClient(requireSession(context));
}

function parseJsonArguments(rawArguments: string | undefined) {
  if (!rawArguments || !rawArguments.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(rawArguments);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw new Error(`Invalid tool arguments: ${rawArguments}`);
}

function extractOutputText(payload: ResponsesApiPayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const messageTexts = (payload.output ?? [])
    .filter((item): item is ResponseMessage => typeof item === "object" && item !== null && (item as ResponseMessage).type === "message")
    .flatMap((message) => message.content ?? [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text?.trim())
    .filter((value): value is string => Boolean(value));

  return messageTexts.join("\n").trim();
}

function extractFunctionCalls(payload: ResponsesApiPayload) {
  return (payload.output ?? []).filter(
    (item): item is ResponseFunctionCall =>
      typeof item === "object" && item !== null && (item as ResponseFunctionCall).type === "function_call",
  );
}

function buildToolSchema(tool: ToolDefinition) {
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  };
}

function maybeAutoLoginRequest(input: string) {
  const lower = input.toLowerCase();
  return /sign in|login|log in|remote|deploy|create.*dataset|make.*dataset|upload|run /.test(lower);
}

function maybeHandleUnauthenticatedLocalRequest(input: string) {
  const lower = input.toLowerCase();
  if (/list .*local|show .*local|local datasets|instances/.test(lower)) {
    return "list_local_datasets";
  }
  if (/show .*runs|list .*runs|tracked runs|active runs/.test(lower)) {
    return "list_tracked_runs";
  }
  return null;
}

function createToolRegistry(): ToolDefinition[] {
  return [
    {
      name: "login",
      description: "Sign in to alpharesearch.nyc and save a CLI session token locally.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      async execute(context) {
        if (context.session) {
          return {
            summary: `Already signed in to ${context.session.origin}.`,
            data: { origin: context.session.origin, createdAt: context.session.createdAt },
          };
        }
        const session = await login({}, (message) => {
          context.emit({ role: "tool", content: message });
        });
        context.session = session;
        return {
          summary: `Signed in to ${session.origin}.`,
          data: { origin: session.origin, createdAt: session.createdAt },
        };
      },
    },
    {
      name: "resolve_local_dataset",
      description: "Resolve a vague local dataset description to an absolute file path and inferred ingest defaults.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          hint: { type: "string" },
        },
        required: ["hint"],
      },
      async execute(_context, input) {
        const hint = typeof input.hint === "string" ? input.hint : "";
        const resolvedPath = await inferLocalDatasetPath(hint);
        if (!resolvedPath) {
          return {
            summary: "Could not resolve a local dataset file from that description.",
            data: { ok: false },
          };
        }
        const defaults = inferDatasetDefaults(resolvedPath);
        const ingestFlags = inferDatasetIngestFlags(resolvedPath);
        const metadata = await stat(resolvedPath);
        return {
          summary: `Resolved local dataset to ${resolvedPath}.`,
          data: {
            ok: true,
            inputPath: resolvedPath,
            mode: inferModeFromPath(resolvedPath),
            instanceId: defaults.id,
            datasetId: defaults.datasetId,
            name: defaults.name,
            sizeBytes: metadata.size,
            ingestConfig: ingestFlags ?? undefined,
          },
        };
      },
    },
    {
      name: "list_local_datasets",
      description: "List local dataset instances available in the CLI workspace.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      async execute() {
        const instances = await listInstanceBundles(DEFAULT_INSTANCE_ROOT);
        return {
          summary: instances.length > 0
            ? `Found ${instances.length} local dataset${instances.length === 1 ? "" : "s"}.`
            : "No local datasets found.",
          data: { instances },
        };
      },
    },
    {
      name: "list_remote_datasets",
      description: "List datasets registered on the remote Alpha Research control plane.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      async execute(context) {
        const client = createRemoteClient(context);
        const datasets = await client.listDatasets();
        return {
          summary: datasets.datasets.length > 0
            ? `Found ${datasets.datasets.length} remote dataset${datasets.datasets.length === 1 ? "" : "s"}.`
            : "No remote datasets found.",
          data: datasets,
        };
      },
    },
    {
      name: "list_tracked_runs",
      description: "List RESEARCH runs tracked locally by the CLI, including in-progress deploy or query runs.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      async execute() {
        const runs = await readTrackedRuns();
        const active = runs.filter((item) => !item.terminalAt && !isTerminalRunStatus(item.status));
        return {
          summary: active.length > 0
            ? `There are ${active.length} active tracked run${active.length === 1 ? "" : "s"}.`
            : runs.length > 0
              ? `There are ${runs.length} tracked runs and none are currently active.`
              : "No tracked runs yet.",
          data: { runs },
        };
      },
    },
    {
      name: "register_remote_dataset",
      description: "Create or update a remote dataset record before source upload and deploy.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          name: { type: "string" },
          inputPath: { type: "string" },
          mode: { type: "string", enum: ["auto", "tabular", "unstructured"] },
          description: { type: "string" },
        },
        required: ["datasetId", "name"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const name = String(input.name);
        const inputPath = typeof input.inputPath === "string" ? input.inputPath : "";
        const inferredFlags = inputPath ? inferDatasetIngestFlags(inputPath) : null;
        const result = await client.createDataset({
          datasetId,
          name,
          sourceType: "uploaded_source",
          sourceFilename: inputPath ? basename(inputPath) : undefined,
          mode: (typeof input.mode === "string" ? input.mode : (inputPath ? inferModeFromPath(inputPath) : "auto")) as
            "auto" | "tabular" | "unstructured",
          description: typeof input.description === "string"
            ? input.description
            : inputPath
              ? `Uploaded from ${inputPath}`
              : undefined,
          ingestConfig: inferredFlags
            ? {
                entityType: inferredFlags.entityType,
                titleField: inferredFlags.titleField,
                summaryField: inferredFlags.summaryField,
                textFields: inferredFlags.textFields,
                dateField: inferredFlags.dateField,
              }
            : undefined,
        });
        return {
          summary: `Registered remote dataset ${datasetId}.`,
          data: result,
        };
      },
    },
    {
      name: "request_dataset_source_upload",
      description: "Request a presigned upload target for a local dataset file.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          inputPath: { type: "string" },
          filename: { type: "string" },
        },
        required: ["datasetId"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const inputPath = typeof input.inputPath === "string" ? input.inputPath : "";
        const filename = typeof input.filename === "string" && input.filename.trim()
          ? input.filename.trim()
          : inputPath
            ? basename(inputPath)
            : "";
        if (!filename) {
          throw new Error("request_dataset_source_upload requires inputPath or filename.");
        }
        const sizeBytes = inputPath ? (await stat(inputPath)).size : undefined;
        const upload = await client.requestDatasetSourceUpload(datasetId, { filename, sizeBytes });
        return {
          summary: `Requested upload target for ${filename}.`,
          data: upload,
        };
      },
    },
    {
      name: "upload_local_file",
      description: "Upload a local file to a presigned object-store URL.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          inputPath: { type: "string" },
          uploadUrl: { type: "string" },
        },
        required: ["inputPath", "uploadUrl"],
      },
      async execute(context, input) {
        const inputPath = String(input.inputPath);
        const uploadUrl = String(input.uploadUrl);
        const sizeBytes = await uploadFileToPresignedUrl(inputPath, uploadUrl, (message) => {
          context.emit({ role: "tool", content: message });
        });
        return {
          summary: `Uploaded ${basename(inputPath)}.`,
          data: { inputPath, sizeBytes },
        };
      },
    },
    {
      name: "complete_dataset_source_upload",
      description: "Mark the uploaded dataset source as complete on the remote control plane.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          sizeBytes: { type: "number" },
        },
        required: ["datasetId"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const sizeBytes = typeof input.sizeBytes === "number" ? input.sizeBytes : undefined;
        await client.completeDatasetSourceUpload(datasetId, { sizeBytes });
        return {
          summary: `Marked source upload complete for ${datasetId}.`,
          data: { datasetId, sizeBytes },
        };
      },
    },
    {
      name: "deploy_remote_dataset",
      description: "Provision remote infrastructure and start normalization for a registered dataset.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
        },
        required: ["datasetId"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const deployment = await client.deployDataset(datasetId);
        if (deployment.run && context.session) {
          await trackRemoteRun({
            id: deployment.run.id,
            datasetId: deployment.run.datasetId,
            origin: context.session.origin,
            status: deployment.run.status,
            prompt: deployment.run.prompt,
            createdAt: deployment.run.createdAt,
            updatedAt: deployment.run.updatedAt,
          });
        }
        return {
          summary: `Started deployment for ${datasetId}.`,
          data: deployment,
        };
      },
    },
    {
      name: "deploy_local_instance",
      description: "Register and deploy an existing local normalized instance bundle.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          instanceId: { type: "string" },
          datasetId: { type: "string" },
        },
        required: ["instanceId"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const instanceId = String(input.instanceId);
        const bootstrap = await getInstanceBootstrap(DEFAULT_INSTANCE_ROOT, instanceId);
        const datasetId = typeof input.datasetId === "string" && input.datasetId.trim()
          ? input.datasetId.trim()
          : bootstrap.descriptor.id;
        await client.createDataset({
          name: bootstrap.implementation.productName,
          datasetId,
          sourceType: "local_instance",
          instanceId,
          manifestPath: `${DEFAULT_INSTANCE_ROOT}/${instanceId}/manifest.json`,
          description: bootstrap.descriptor.description,
        });
        const deployment = await client.deployDataset(datasetId);
        if (deployment.run && context.session) {
          await trackRemoteRun({
            id: deployment.run.id,
            datasetId: deployment.run.datasetId,
            origin: context.session.origin,
            status: deployment.run.status,
            prompt: deployment.run.prompt,
            createdAt: deployment.run.createdAt,
            updatedAt: deployment.run.updatedAt,
          });
        }
        return {
          summary: `Started deployment for local instance ${instanceId}.`,
          data: deployment,
        };
      },
    },
    {
      name: "start_remote_run",
      description: "Start a long-running remote AI run against a deployed dataset.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          prompt: { type: "string" },
        },
        required: ["datasetId", "prompt"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const prompt = String(input.prompt);
        const result = await client.startRun(datasetId, prompt);
        if (context.session) {
          await trackRemoteRun({
            id: result.run.id,
            datasetId: result.run.datasetId,
            origin: context.session.origin,
            status: result.run.status,
            prompt: result.run.prompt ?? prompt,
            createdAt: result.run.createdAt,
            updatedAt: result.run.updatedAt,
          });
        }
        return {
          summary: `Started run ${result.run.id} on ${datasetId}.`,
          data: result,
        };
      },
    },
  ];
}

export async function runAgentTurn(
  input: string,
  initialSession: SessionRecord | null,
  emit: (message: AgentMessage) => void,
): Promise<void> {
  const localIntent = !initialSession ? maybeHandleUnauthenticatedLocalRequest(input) : null;
  const toolRegistry = createToolRegistry();
  const toolsByName = new Map(toolRegistry.map((tool) => [tool.name, tool]));
  const context: ToolExecutionContext = {
    session: initialSession,
    emit,
  };

  if (!context.session && localIntent) {
    const tool = toolsByName.get(localIntent);
    if (!tool) {
      throw new Error(`Missing local tool: ${localIntent}`);
    }
    emit({ role: "tool", content: `Running ${tool.name}` });
    const result = await tool.execute(context, {});
    emit({ role: "assistant", content: typeof result.data === "object" ? JSON.stringify(result.data, null, 2) : result.summary });
    return;
  }

  if (!context.session && maybeAutoLoginRequest(input)) {
    const loginTool = toolsByName.get("login");
    if (!loginTool) {
      throw new Error("Missing login tool.");
    }
    emit({ role: "tool", content: "Signing in before continuing." });
    const result = await loginTool.execute(context, {});
    emit({ role: "assistant", content: result.summary });
  }

  if (!context.session) {
    emit({
      role: "assistant",
      content: "Sign in first with `/login`, then ask me to create datasets, deploy them, or manage runs.",
    });
    return;
  }

  const client = new RemoteApiClient(context.session);
  const toolSchemas = toolRegistry.map(buildToolSchema);
  let response = await client.respond({
    instructions: AGENT_INSTRUCTIONS,
    input,
    tools: toolSchemas,
    parallel_tool_calls: false,
  });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const functionCalls = extractFunctionCalls(response);
    if (functionCalls.length === 0) {
      const text = extractOutputText(response);
      emit({
        role: "assistant",
        content: text || "Done.",
      });
      return;
    }

    const toolOutputs: Array<{ type: "function_call_output"; call_id: string; output: string }> = [];

    for (const call of functionCalls) {
      const toolName = call.name ?? "";
      const tool = toolsByName.get(toolName);
      if (!tool) {
        throw new Error(`Model requested unknown tool: ${toolName}`);
      }
      emit({ role: "tool", content: `Calling ${tool.name}` });
      const parsedArguments = parseJsonArguments(call.arguments);
      const result = await tool.execute(context, parsedArguments);
      emit({ role: "tool", content: result.summary });
      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id ?? tool.name,
        output: JSON.stringify({
          ok: true,
          summary: result.summary,
          data: result.data,
        }),
      });
    }

    const refreshedSession = await readSession();
    if (refreshedSession?.accessToken !== context.session.accessToken || refreshedSession?.origin !== context.session.origin) {
      context.session = refreshedSession;
    }
    if (!context.session) {
      emit({
        role: "assistant",
        content: "Your RESEARCH session was cleared while tools were running. Sign in again with `/login`.",
      });
      return;
    }

    response = await new RemoteApiClient(context.session).respond({
      previous_response_id: response.id,
      input: toolOutputs,
      tools: toolSchemas,
      parallel_tool_calls: false,
    });
  }

  emit({
    role: "assistant",
    content: "I hit the tool-call limit before finishing. Try again or narrow the request.",
  });
}

export function currentOrigin(session: SessionRecord | null) {
  return session?.origin ?? DEFAULT_WEB_ORIGIN;
}
