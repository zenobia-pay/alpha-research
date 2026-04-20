import { spawn } from "node:child_process";
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
import { readTrackedRuns, trackRemoteRun } from "./runs.js";

export function printUsage() {
  console.log([
    "research",
    "",
    "Commands:",
    "  research                         Start the interactive agent UI",
    "  research --alt-screen           Start the interactive agent UI in alternate-screen mode",
    "  agent                           Start the interactive agent UI",
    "  install-prompt --dataset <path> [--mode auto|tabular|unstructured] [--name <name>] [--id <instance-id>]",
    "  login [--origin <web-origin>] [--token <token>]",
    "  whoami",
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
    await runIngest(rest);
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
