import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SESSION_DIR = join(homedir(), ".research");
export const SESSION_PATH = join(SESSION_DIR, "session.json");
export const RUNS_PATH = join(SESSION_DIR, "runs.json");
export const DEFAULT_WEB_ORIGIN = process.env.ALPHA_RESEARCH_WEB_ORIGIN ?? "https://alpharesearch.nyc";
export const DEFAULT_DASHBOARD_ORIGIN = process.env.ALPHA_RESEARCH_DASHBOARD_ORIGIN ?? "https://dashboard.alpharesearch.nyc";
export const DEFAULT_INSTALL_URL = process.env.ALPHA_RESEARCH_INSTALL_URL
  ?? "https://raw.githubusercontent.com/zenobia-pay/alpha-research/codex/initial-substrate/scripts/install_alpha_research.sh";
export const DEFAULT_INSTANCE_ROOT = process.env.DATASET_INSTANCE_ROOT
  ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/instances");
export const INGEST_SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../scripts/normalize_dataset.py");
export const RUN_WATCHER_SCRIPT = fileURLToPath(new URL("./run-watcher.js", import.meta.url));
export const DEFAULT_AGENT_MODEL = process.env.RESEARCH_AGENT_MODEL ?? "gpt-5";
export const RUN_POLL_INTERVAL_MS = Number(process.env.RESEARCH_RUN_POLL_INTERVAL_MS ?? "5000");

export type SessionRecord = {
  origin: string;
  accessToken: string;
  createdAt: string;
};

export function dashboardOriginFor(origin: string) {
  if (origin.includes("localhost")) {
    return `${origin}?view=dashboard`;
  }
  return DEFAULT_DASHBOARD_ORIGIN;
}

export function dashboardRunUrl(origin: string, runId: string) {
  const base = dashboardOriginFor(origin);
  return `${base}#run-${encodeURIComponent(runId)}`;
}
