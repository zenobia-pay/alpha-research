import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

type Mode = "create" | "status" | "improve" | "audit";

type Args = {
  mode: Mode;
  datasetId: string;
  name?: string;
  fieldBrief?: string;
  sources?: string;
  source?: string[];
  dryRun: boolean;
  promptTimestamp?: string;
};

type Session = {
  origin: string;
  accessToken: string;
};

type RemoteDataset = {
  id: string;
  name?: string;
  status?: string;
  deploymentStatus?: string;
  activeRunId?: string | null;
  manifestPath?: string | null;
  profile?: {
    briefingMarkdown?: string | null;
    volumeInventoryRunId?: string | null;
    volumeInventoryUpdatedAt?: string | null;
    diskInventoryProven?: boolean | null;
    quality?: unknown;
    tables?: unknown;
    sources?: unknown;
  } | null;
};

export const CANONICAL_PUBLIC_RESOURCES = {
  profile: "canonical-public",
  runnerSize: "s-4vcpu-8gb",
  workspaceDiskGb: 50,
  storageMode: "object-store-versioned",
  datasetAccess: "write-version",
  publishMode: "versioned",
};

export const REQUIRED_CANONICAL_ARTIFACTS = [
  { type: "file", title: "manifest.json", path: "manifest.json" },
  { type: "file", title: "source_registry.csv", path: "source_registry.csv" },
  { type: "file", title: "source_registry.plan.json", path: "source_registry.plan.json" },
  { type: "file", title: "download_inventory.jsonl", path: "download_inventory.jsonl" },
  { type: "file", title: "download_inventory.csv", path: "download_inventory.csv" },
  { type: "file", title: "download_events.jsonl", path: "download_events.jsonl" },
  { type: "file", title: "slack_download_alerts.jsonl", path: "slack_download_alerts.jsonl" },
  { type: "file", title: "slack_briefing.md", path: "slack_briefing.md" },
  { type: "file", title: "raw_inventory.jsonl", path: "raw_inventory.jsonl" },
  { type: "file", title: "raw_inventory.csv", path: "raw_inventory.csv" },
  { type: "file", title: "volume_inventory.jsonl", path: "volume_inventory.jsonl" },
  { type: "file", title: "volume_inventory.csv", path: "volume_inventory.csv" },
  { type: "structured_result", title: "volume_inventory_summary.json", path: "volume_inventory_summary.json" },
  { type: "file", title: "volume_tree.txt", path: "volume_tree.txt" },
  { type: "file", title: "data_dictionary.md", path: "data_dictionary.md" },
  { type: "file", title: "quality_report.md", path: "quality_report.md" },
  { type: "file", title: "dataset_briefing.md", path: "dataset_briefing.md" },
] as const;

export const CANONICAL_RUNTIME_CONTRACT = {
  requiresCodexLogin: true,
  requiredEnvironment: [
    "CANONICAL_DATASET_SLACK_WEBHOOK_URL",
  ],
  optionalEnvironment: [
    "EXA_API_KEY",
  ],
} as const;

const MODE_TEMPLATES: Record<Exclude<Mode, "status">, string> = {
  create: "prompts/canonical-dataset-build.md",
  improve: "prompts/canonical-dataset-improve-single.md",
  audit: "prompts/canonical-dataset-audit.md",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function usage(): string {
  return [
    "Usage:",
    "  npm run canonical:dataset -- create --dataset-id <id> --name <name> --field-brief <text> --sources <file> [--dry-run]",
    "  npm run canonical:dataset -- status --dataset-id <id>",
    "  npm run canonical:dataset -- improve --dataset-id <id> [--field-brief <text>] [--dry-run]",
    "  npm run canonical:dataset -- audit --dataset-id <id> [--field-brief <text>] [--dry-run]",
  ].join("\n");
}

export function parseArgs(argv: string[]): Args {
  const [modeRaw, ...rest] = argv;
  assert(modeRaw === "create" || modeRaw === "status" || modeRaw === "improve" || modeRaw === "audit", usage());
  const args: Args = { mode: modeRaw, datasetId: "", dryRun: false, source: [] };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]!;
    const next = () => {
      const value = rest[index + 1];
      assert(value && !value.startsWith("--"), `Missing value for ${token}`);
      index += 1;
      return value;
    };
    switch (token) {
      case "--dataset-id":
        args.datasetId = next();
        break;
      case "--name":
        args.name = next();
        break;
      case "--field-brief":
        args.fieldBrief = next();
        break;
      case "--sources":
        args.sources = next();
        break;
      case "--source":
        args.source?.push(next());
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--prompt-timestamp":
        args.promptTimestamp = next();
        break;
      default:
        throw new Error(`Unknown argument ${token}\n${usage()}`);
    }
  }

  assert(args.datasetId, "--dataset-id is required");
  if (args.mode === "create") {
    assert(args.name, "--name is required for create");
    assert(args.fieldBrief, "--field-brief is required for create");
    assert(args.sources || (args.source && args.source.length > 0), "--sources <file> or --source is required for create");
  }
  return args;
}

export async function loadSourceCatalog(args: Pick<Args, "sources" | "source">): Promise<string> {
  const entries: string[] = [];
  if (args.sources) {
    entries.push((await readFile(args.sources, "utf8")).trim());
  }
  for (const entry of args.source ?? []) {
    entries.push(entry.trim().startsWith("- ") ? entry.trim() : `- ${entry.trim()}`);
  }
  return entries.filter(Boolean).join("\n");
}

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replaceAll(/\{([a-zA-Z0-9_]+)\}/gu, (_match, key: string) => values[key] ?? "");
}

export async function renderPrompt(mode: Exclude<Mode, "status">, input: {
  datasetId: string;
  datasetName: string;
  fieldBrief: string;
  sourceCatalog?: string;
}): Promise<string> {
  const template = await readFile(MODE_TEMPLATES[mode], "utf8");
  return renderTemplate(template, {
    datasetId: input.datasetId,
    datasetName: input.datasetName,
    fieldBrief: input.fieldBrief,
    sourceCatalog: input.sourceCatalog ?? "- (No starting sources provided for this mode.)",
  });
}

export function promptRecordPath(datasetId: string, timestamp: string, mode: Mode): string {
  const safeTimestamp = timestamp.replaceAll(/[:.]/gu, "-");
  return `docs/canonical-runs/${datasetId}/${safeTimestamp}/${mode}-prompt.md`;
}

export async function persistPrompt(datasetId: string, mode: Mode, prompt: string, timestamp = new Date().toISOString()): Promise<string> {
  const path = promptRecordPath(datasetId, timestamp, mode);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, prompt.endsWith("\n") ? prompt : `${prompt}\n`, "utf8");
  return path;
}

export function artifactContract(datasetId: string, mode: Mode) {
  const docsArtifacts = [
    { type: "file", title: "docs briefing mirror", path: `docs/public-datasets/briefings/${datasetId}.md` },
    { type: "file", title: "docs dataset page", path: `docs/public-datasets/${datasetId}.mdx` },
  ];
  if (mode === "improve") {
    return [
      { type: "file", title: "improvement_plan.md", path: "improvement_plan.md" },
      { type: "structured_result", title: "improvement_result.json", path: "improvement_result.json" },
      { type: "table", title: "candidate_sources.csv", path: "candidate_sources.csv" },
      { type: "structured_result", title: "exa_search_log.json", path: "exa_search_log.json" },
      ...REQUIRED_CANONICAL_ARTIFACTS,
      ...docsArtifacts,
    ];
  }
  if (mode === "audit") {
    return [
      { type: "file", title: "volume_inventory.jsonl", path: "volume_inventory.jsonl" },
      { type: "file", title: "volume_inventory.csv", path: "volume_inventory.csv" },
      { type: "structured_result", title: "volume_inventory_summary.json", path: "volume_inventory_summary.json" },
      { type: "file", title: "volume_tree.txt", path: "volume_tree.txt" },
      { type: "file", title: "dataset_briefing.md", path: "dataset_briefing.md" },
      { type: "file", title: "download_events.jsonl", path: "download_events.jsonl" },
      { type: "file", title: "slack_download_alerts.jsonl", path: "slack_download_alerts.jsonl" },
      { type: "file", title: "slack_briefing.md", path: "slack_briefing.md" },
      ...docsArtifacts,
    ];
  }
  return [...REQUIRED_CANONICAL_ARTIFACTS, ...docsArtifacts];
}

export function classifyDatasetStatus(dataset: RemoteDataset | null | undefined) {
  if (!dataset) {
    return { status: "missing_dataset" };
  }
  const datasetStatus = dataset.status ?? "unknown";
  const deploymentStatus = dataset.deploymentStatus ?? "unknown";
  const activeRunId = dataset.activeRunId ?? null;
  if (activeRunId) {
    return { status: "active_run", datasetStatus, deploymentStatus, activeRunId };
  }
  if (datasetStatus === "failed" || deploymentStatus === "failed") {
    return { status: "failed_deployment", datasetStatus, deploymentStatus };
  }
  const ready = datasetStatus === "ready" && deploymentStatus === "ready";
  if (!ready) {
    return { status: "not_ready", datasetStatus, deploymentStatus };
  }
  const profile = dataset.profile ?? null;
  const diskInventoryProven = profile?.diskInventoryProven === true
    || (typeof profile?.volumeInventoryUpdatedAt === "string" && profile.volumeInventoryUpdatedAt.length > 0);
  if (!diskInventoryProven) {
    return { status: "not_disk_proven", datasetStatus, deploymentStatus };
  }
  return {
    status: "disk_proven",
    datasetStatus,
    deploymentStatus,
    volumeInventoryRunId: profile?.volumeInventoryRunId ?? null,
    volumeInventoryUpdatedAt: profile?.volumeInventoryUpdatedAt ?? null,
  };
}

function readSession(): Session {
  const sessionPath = process.env.RESEARCH_SESSION_PATH ?? join(homedir(), ".research", "session.json");
  const session = JSON.parse(readFileSync(sessionPath, "utf8")) as Session;
  assert(typeof session.origin === "string" && session.origin.startsWith("http"), `Invalid session origin in ${sessionPath}.`);
  assert(typeof session.accessToken === "string" && session.accessToken.length > 0, `Missing access token in ${sessionPath}.`);
  return session;
}

async function api<T>(session: Session, path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${session.origin}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`Remote request failed (${response.status}) for ${path}: ${text || "{}"}`);
  }
  return body as T;
}

function dashboardRunUrl(runId: string) {
  const url = new URL(process.env.ALPHA_RESEARCH_DASHBOARD_ORIGIN ?? "https://dashboard.alpharesearch.nyc");
  url.searchParams.set("view", "runs");
  url.searchParams.set("runId", runId);
  url.hash = `run-${encodeURIComponent(runId)}`;
  return url.toString();
}

async function getDataset(session: Session, datasetId: string) {
  const payload = await api<{ dataset: RemoteDataset }>(session, `/api/cli/datasets/${encodeURIComponent(datasetId)}`).catch((error) => {
    if (error instanceof Error && /Remote request failed \(404\)/u.test(error.message)) return null;
    throw error;
  });
  return payload?.dataset ?? null;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (args.mode === "status") {
    const session = readSession();
    const dataset = await getDataset(session, args.datasetId);
    console.log(JSON.stringify({ datasetId: args.datasetId, ...classifyDatasetStatus(dataset), dataset }, null, 2));
    return;
  }

  const existing = args.dryRun ? null : await getDataset(readSession(), args.datasetId).catch(() => null);
  const datasetName = args.name ?? existing?.name ?? args.datasetId;
  const fieldBrief = args.fieldBrief ?? existing?.profile?.briefingMarkdown ?? existing?.name ?? args.datasetId;
  const sourceCatalog = args.mode === "create" ? await loadSourceCatalog(args) : undefined;
  const prompt = await renderPrompt(args.mode, {
    datasetId: args.datasetId,
    datasetName,
    fieldBrief,
    sourceCatalog,
  });
  const promptPath = await persistPrompt(args.datasetId, args.mode, prompt, args.promptTimestamp ?? new Date().toISOString());
  const artifacts = artifactContract(args.datasetId, args.mode);

  if (args.dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      mode: args.mode,
      datasetId: args.datasetId,
      promptPath,
      promptLength: prompt.length,
      resources: CANONICAL_PUBLIC_RESOURCES,
      artifacts,
      status: existing ? classifyDatasetStatus(existing) : { status: "missing_dataset" },
    }, null, 2));
    return;
  }

  const session = readSession();

  if (args.mode === "create") {
    const result = await api<{ run?: { id?: string }; dataset?: RemoteDataset; environment?: unknown }>(
      session,
      `/api/cli/datasets/${encodeURIComponent(args.datasetId)}/public-environment`,
      {
        method: "POST",
        body: {
          name: datasetName,
          description: `Canonical public dataset for ${datasetName}.`,
          sourceDescription: `Canonical public sources for ${datasetName}.`,
          prompt,
          resources: CANONICAL_PUBLIC_RESOURCES,
          config: {
            canonicalDatasetLifecycle: true,
            jobKind: "dataset-create",
            datasetId: args.datasetId,
            datasetName,
            writesDatasetBriefing: true,
            syncsDocsFromBriefing: true,
            requiresVolumeInventory: true,
            requiresDownloadEventLog: true,
            requiresSlackDownloadAlerts: true,
            ...CANONICAL_RUNTIME_CONTRACT,
          },
          artifacts,
        },
      },
    );
    const runId = result.run?.id ?? null;
    console.log(JSON.stringify({
      mode: args.mode,
      datasetId: args.datasetId,
      promptPath,
      status: "started",
      runId,
      dashboardUrl: runId ? dashboardRunUrl(runId) : null,
      result,
    }, null, 2));
    return;
  }

  const state = classifyDatasetStatus(existing);
  if (!existing) {
    console.log(JSON.stringify({ mode: args.mode, datasetId: args.datasetId, promptPath, status: "missing_dataset" }, null, 2));
    process.exitCode = 1;
    return;
  }
  if (state.status === "active_run" || state.status === "not_ready" || state.status === "failed_deployment") {
    console.log(JSON.stringify({ mode: args.mode, datasetId: args.datasetId, promptPath, status: "blocked", blocker: state }, null, 2));
    process.exitCode = 1;
    return;
  }

  const result = await api<{ run?: { id?: string } }>(
    session,
    `/api/cli/datasets/${encodeURIComponent(args.datasetId)}/runs`,
    {
      method: "POST",
      body: {
        prompt,
        type: args.mode === "audit" ? "analysis" : "analysis",
        config: {
          canonicalDatasetLifecycle: true,
          jobKind: args.mode === "audit" ? "dataset-disk-audit" : "dataset-improvement",
          datasetId: args.datasetId,
          datasetName,
          writesDatasetBriefing: true,
          syncsDocsFromBriefing: true,
          requiresVolumeInventory: true,
          requiresDownloadEventLog: true,
          requiresSlackDownloadAlerts: true,
          resources: CANONICAL_PUBLIC_RESOURCES,
          ...CANONICAL_RUNTIME_CONTRACT,
        },
        artifacts,
      },
    },
  );
  const runId = result.run?.id ?? null;
  console.log(JSON.stringify({
    mode: args.mode,
    datasetId: args.datasetId,
    promptPath,
    status: "started",
    runId,
    dashboardUrl: runId ? dashboardRunUrl(runId) : null,
    result,
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
