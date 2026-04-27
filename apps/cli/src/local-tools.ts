import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

import {
  aggregateRecords,
  buildTextCompatibleDocuments,
  describeDataset,
  queryDataset,
  type DatasetFilter,
} from "@alpha-datasets/core";
import { getFixtureAdapter } from "@alpha-datasets/fixture";
import {
  aggregateInstance,
  buildTextCompatibleDocumentsForInstance,
  getInstanceBootstrap,
  listInstanceBundles,
  queryInstance,
} from "@alpha-datasets/storage";

import { DEFAULT_INSTANCE_ROOT, INGEST_SCRIPT, type SessionRecord } from "./config.js";
import { parseFilter } from "./flags.js";
import { readSession } from "./session.js";
import { RemoteApiClient } from "./remote.js";
import { readTrackedRuns, spawnRunWatcher, trackRemoteRun } from "./runs.js";

export function printUsage() {
  console.log([
    "research",
    "",
    "Commands:",
    "  research                         Start the interactive agent UI",
    "  research --alt-screen           Start the interactive agent UI in alternate-screen mode",
    "  research --prompt <text>        Run a single prompt without entering the interactive UI",
    "  agent                           Start the interactive agent UI",
    "  prompt <text>                   Run a single prompt without entering the interactive UI",
    "  install-prompt --dataset <path> [--mode auto|tabular|unstructured] [--name <name>] [--id <instance-id>]",
    "  login [--origin <web-origin>] [--token <token>]",
    "  whoami",
    "  debug run <run-id> [--output <path>]",
    "  symphony [path-to-WORKFLOW.md]",
    "  instances [--root <dir>]",
    "  describe-instance <instance-id> [--root <dir>]",
    "  query-instance <instance-id> [--root <dir>] [--text <query>] [--filter <field:eq:value>]",
    "  aggregate-instance <instance-id> --group-by <field> --measure <field> [--root <dir>] [--op <op>]",
    "  documents-instance <instance-id> [--root <dir>] [--limit <n>]",
    "  ingest --mode <auto|tabular|unstructured> --input <path> --id <instance-id> --name <product-name> [additional flags]",
    "  remote-datasets",
    "  remote-runs [--dataset-id <dataset-id>]",
    "  runs",
    "  deploy-instance <instance-id> [--root <dir>] [--remote-dataset-id <dataset-id>]",
    "  start-run --dataset-id <dataset-id> --prompt <prompt>",
    "  fixture describe <dataset-id>",
    "  fixture preview <dataset-id>",
    "  fixture query <dataset-id> [--text <query>] [--filter <field:eq:value>]",
    "  fixture aggregate <dataset-id> --group-by <field> --measure <field> [--op <op>]",
    "  fixture documents <dataset-id>",
  ].join("\n"));
}

export async function runIngest(args: string[], logger: (message: string) => void = console.log) {
  const python = process.env.PYTHON_BIN ?? "python3";
  logger(`Starting RESEARCH ingest via ${python} ${INGEST_SCRIPT}`);
  if (args.length > 0) {
    logger(`Arguments: ${args.join(" ")}`);
  }
  const child = spawn(python, [INGEST_SCRIPT, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  await new Promise<void>((resolve, reject) => {
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`normalize_dataset.py exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

export async function uploadFileToPresignedUrl(filePath: string, uploadUrl: string, logger: (message: string) => void = console.log) {
  const metadata = await stat(filePath);
  logger(`Uploading ${filePath} (${metadata.size.toLocaleString()} bytes)`);
  const init = {
    method: "PUT",
    headers: {
      "Content-Length": String(metadata.size),
      "Content-Type": "application/octet-stream",
    },
    body: createReadStream(filePath) as unknown as BodyInit,
    duplex: "half" as const,
  } as RequestInit & { duplex: "half" };
  const response = await fetch(uploadUrl, init);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Upload failed (${response.status})${detail ? ` ${detail}` : ""}`);
  }
  logger(`Upload complete for ${filePath}`);
  return metadata.size;
}

export async function inspectLocalDatasetFile(filePath: string) {
  const python = process.env.PYTHON_BIN ?? "python3";
  const script = `
import json, os, sys
path = sys.argv[1]
lower = path.lower()

def normalize_value(value):
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    try:
        if hasattr(value, "isoformat"):
            return value.isoformat()
    except Exception:
        pass
    return str(value)

def emit(schema, sample_rows, notes=None):
    print(json.dumps({
        "schema": schema,
        "sampleRows": sample_rows,
        "notes": notes,
    }))

if lower.endswith(".parquet"):
    import pyarrow.parquet as pq
    parquet = pq.ParquetFile(path)
    schema = [
        {"name": field.name, "type": str(field.type)}
        for field in parquet.schema_arrow
    ]
    sample_rows = []
    for batch in parquet.iter_batches(batch_size=5):
        table = batch.to_pydict()
        row_count = len(next(iter(table.values()), []))
        for idx in range(row_count):
            sample_rows.append({key: normalize_value(values[idx]) for key, values in table.items()})
            if len(sample_rows) >= 5:
                break
        break
    emit(schema, sample_rows, f"rows={parquet.metadata.num_rows}")
elif lower.endswith(".csv"):
    import csv
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        schema = [{"name": name, "type": "string"} for name in (reader.fieldnames or [])]
        sample_rows = []
        for row in reader:
            sample_rows.append({key: normalize_value(value) for key, value in row.items()})
            if len(sample_rows) >= 5:
                break
    emit(schema, sample_rows)
elif lower.endswith(".json"):
    with open(path, encoding="utf-8") as fh:
        payload = json.load(fh)
    rows = payload if isinstance(payload, list) else [payload]
    sample_rows = []
    schema_keys = set()
    for row in rows[:5]:
        if isinstance(row, dict):
            schema_keys.update(row.keys())
            sample_rows.append({key: normalize_value(value) for key, value in row.items()})
        else:
            sample_rows.append({"value": normalize_value(row)})
    schema = [{"name": key, "type": "unknown"} for key in sorted(schema_keys)] or [{"name": "value", "type": "unknown"}]
    emit(schema, sample_rows)
else:
    with open(path, encoding="utf-8", errors="replace") as fh:
        lines = [line.rstrip("\\n") for _, line in zip(range(5), fh)]
    emit(
        [{"name": "text", "type": "string"}],
        [{"text": line} for line in lines],
        "Plain-text sample preview",
    )
`;
  const child = spawn(python, ["-c", script, filePath], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  await new Promise<void>((resolve, reject) => {
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `inspectLocalDatasetFile failed with code ${code}`));
    });
    child.on("error", reject);
  });
  return JSON.parse(stdout) as { schema: unknown; sampleRows: unknown; notes?: string };
}

export function inferDatasetIngestFlags(inputPath: string) {
  const lower = inputPath.toLowerCase();
  if (lower.includes("tweet")) {
    return {
      entityType: "tweet",
      titleField: "tweet_id",
      summaryField: "full_text",
      textFields: "full_text,username,account_display_name",
      dateField: "created_at",
    };
  }
  return null;
}

export function buildInstallPrompt(flags: Record<string, string>, installUrl: string) {
  const dataset = flags.dataset ?? "<ABSOLUTE_DATASET_PATH>";
  const mode = flags.mode ?? "auto";
  const name = flags.name ?? "My Dataset";
  const id = flags.id ?? "my-dataset";
  const datasetId = flags["dataset-id"] ?? id;
  return [
    "Copy this to your agent:",
    "",
    "Install the RESEARCH CLI, sign in, create a research dataset, and deploy it.",
    "",
    `Run: curl -fsSL ${installUrl} | bash`,
    "",
    "Then run:",
    "research",
    "",
    "Once the agent UI opens, tell it to:",
    `create a dataset from "${dataset}" using mode ${mode}, name "${name}", and dataset id "${datasetId}", then deploy it`,
  ].join("\n");
}

export async function handleFixture(command: string, datasetId: string | undefined, flags: Record<string, string>) {
  if (!command || !datasetId) {
    throw new Error("fixture requires a subcommand and dataset id");
  }
  const adapter = getFixtureAdapter(datasetId);
  if (!adapter) {
    throw new Error(`Unknown fixture dataset: ${datasetId}`);
  }
  if (command === "describe") {
    console.log(describeDataset(adapter));
    return;
  }
  if (command === "preview") {
    console.log(JSON.stringify(await adapter.listRecords(), null, 2));
    return;
  }
  if (command === "query") {
    const filters = flags.filter ? [parseFilter(flags.filter)] : [];
    console.log(JSON.stringify(await queryDataset(adapter, { text: flags.text, filters }), null, 2));
    return;
  }
  if (command === "aggregate") {
    if (!flags["group-by"] || !flags.measure) {
      throw new Error("fixture aggregate requires --group-by and --measure");
    }
    const records = await adapter.listRecords();
    console.log(JSON.stringify(aggregateRecords(records, {
      groupBy: flags["group-by"],
      measure: flags.measure,
      op: (flags.op as "sum" | "avg" | "min" | "max" | "count" | undefined) ?? "sum",
    }), null, 2));
    return;
  }
  if (command === "documents") {
    const records = await adapter.listRecords();
    console.log(JSON.stringify(buildTextCompatibleDocuments(adapter, records), null, 2));
    return;
  }
  throw new Error(`Unknown fixture command: ${command}`);
}

export async function deployLocalInstance(instanceId: string, flags: Record<string, string>) {
  const session = await readSession();
  if (!session) {
    throw new Error("You need to run `research login` before deploying a dataset.");
  }
  const root = flags.root ?? DEFAULT_INSTANCE_ROOT;
  const bootstrap = await getInstanceBootstrap(root, instanceId);
  const manifestPath = resolve(root, instanceId, "manifest.json");
  const manifestExists = await stat(manifestPath).then(() => true).catch(() => false);
  if (!manifestExists) {
    throw new Error(`No manifest found for instance ${instanceId} at ${manifestPath}`);
  }
  const client = new RemoteApiClient(session);
  const datasetId = flags["remote-dataset-id"] ?? bootstrap.descriptor.id;
  const create = await client.createDataset({
    name: bootstrap.implementation.productName,
    datasetId,
    sourceType: "local_instance",
    instanceId,
    manifestPath,
    description: bootstrap.descriptor.description,
  });
  const deployment = await client.deployDataset(datasetId);
  return {
    dataset: create.dataset,
    deployment: deployment.deployment,
  };
}

export async function runScriptedCommand(command: string, rest: string[], flags: Record<string, string>) {
  if (command === "ingest") {
    const nextArgs = [...rest];
    if (!nextArgs.includes("--output-root")) {
      nextArgs.push("--output-root", flags.root ?? DEFAULT_INSTANCE_ROOT);
    }
    const inputIndex = nextArgs.findIndex((value) => value === "--input");
    if (inputIndex !== -1 && inputIndex + 1 < nextArgs.length) {
      const inferredFlags = inferDatasetIngestFlags(nextArgs[inputIndex + 1]!);
      if (inferredFlags && !nextArgs.includes("--text-fields")) {
        nextArgs.push("--entity-type", inferredFlags.entityType);
        nextArgs.push("--title-field", inferredFlags.titleField);
        nextArgs.push("--summary-field", inferredFlags.summaryField);
        nextArgs.push("--text-fields", inferredFlags.textFields);
        nextArgs.push("--date-field", inferredFlags.dateField);
      }
    }
    await runIngest(nextArgs);
    return true;
  }

  if (command === "instances") {
    console.log(JSON.stringify({
      root: flags.root ?? DEFAULT_INSTANCE_ROOT,
      instances: await listInstanceBundles(flags.root ?? DEFAULT_INSTANCE_ROOT),
    }, null, 2));
    return true;
  }

  if (command === "describe-instance") {
    const instanceId = rest[0];
    if (!instanceId) {
      throw new Error("describe-instance requires <instance-id>");
    }
    console.log(JSON.stringify(
      await getInstanceBootstrap(flags.root ?? DEFAULT_INSTANCE_ROOT, instanceId),
      null,
      2,
    ));
    return true;
  }

  if (command === "query-instance") {
    const instanceId = rest[0];
    if (!instanceId) {
      throw new Error("query-instance requires <instance-id>");
    }
    const filters = flags.filter ? [parseFilter(flags.filter)] : [];
    console.log(JSON.stringify(await queryInstance(flags.root ?? DEFAULT_INSTANCE_ROOT, instanceId, {
      text: flags.text,
      filters,
      limit: flags.limit ? Number(flags.limit) : undefined,
    }), null, 2));
    return true;
  }

  if (command === "aggregate-instance") {
    const instanceId = rest[0];
    if (!instanceId) {
      throw new Error("aggregate-instance requires <instance-id>");
    }
    if (!flags["group-by"] || !flags.measure) {
      throw new Error("aggregate-instance requires --group-by and --measure");
    }
    const filters = flags.filter ? [parseFilter(flags.filter)] : [];
    console.log(JSON.stringify(await aggregateInstance(flags.root ?? DEFAULT_INSTANCE_ROOT, instanceId, {
      groupBy: flags["group-by"],
      measure: flags.measure,
      op: (flags.op as "sum" | "avg" | "min" | "max" | "count" | undefined) ?? "sum",
      limit: flags.limit ? Number(flags.limit) : undefined,
      filters,
    }), null, 2));
    return true;
  }

  if (command === "documents-instance") {
    const instanceId = rest[0];
    if (!instanceId) {
      throw new Error("documents-instance requires <instance-id>");
    }
    console.log(JSON.stringify(
      await buildTextCompatibleDocumentsForInstance(
        flags.root ?? DEFAULT_INSTANCE_ROOT,
        instanceId,
        flags.limit ? Number(flags.limit) : undefined,
      ),
      null,
      2,
    ));
    return true;
  }

  if (command === "remote-datasets") {
    const session = await readSession();
    if (!session) {
      throw new Error("You need to run `research login` first.");
    }
    const client = new RemoteApiClient(session);
    console.log(JSON.stringify(await client.listDatasets(), null, 2));
    return true;
  }

  if (command === "remote-runs") {
    const session = await readSession();
    if (!session) {
      throw new Error("You need to run `research login` first.");
    }
    const client = new RemoteApiClient(session);
    console.log(JSON.stringify(await client.listRuns(flags["dataset-id"]), null, 2));
    return true;
  }

  if (command === "runs") {
    console.log(JSON.stringify({ runs: await readTrackedRuns() }, null, 2));
    return true;
  }

  if (command === "deploy-instance") {
    const instanceId = rest[0];
    if (!instanceId) {
      throw new Error("deploy-instance requires <instance-id>");
    }
    console.log(JSON.stringify(await deployLocalInstance(instanceId, flags), null, 2));
    return true;
  }

  if (command === "start-run") {
    const datasetId = flags["dataset-id"];
    const prompt = flags.prompt;
    if (!datasetId || !prompt) {
      throw new Error("start-run requires --dataset-id and --prompt");
    }
    const session = await readSession();
    if (!session) {
      throw new Error("You need to run `research login` first.");
    }
    const client = new RemoteApiClient(session);
    const result = await client.startRun(datasetId, prompt);
    await trackRemoteRun({
      id: result.run.id,
      datasetId: result.run.datasetId,
      origin: session.origin,
      status: result.run.status,
      prompt: result.run.prompt ?? prompt,
      createdAt: result.run.createdAt,
      updatedAt: result.run.updatedAt,
    });
    spawnRunWatcher(result.run.id);
    console.log(JSON.stringify(result, null, 2));
    return true;
  }

  return false;
}

export function inferDatasetDefaults(inputPath: string) {
  const base = basename(inputPath, extname(inputPath));
  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return {
    id: normalized || "dataset",
    datasetId: normalized || "dataset",
    name: base.replace(/[-_]+/gu, " ").trim() || "Dataset",
  };
}

export async function requireRemoteClient() {
  const session = await readSession();
  if (!session) {
    throw new Error("You need to sign in first. Run `research login`.");
  }
  return new RemoteApiClient(session);
}
