import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SESSION_DIR = join(homedir(), ".research");
export const SESSION_PATH = join(SESSION_DIR, "session.json");
export const DEFAULT_WEB_ORIGIN = process.env.ALPHA_RESEARCH_WEB_ORIGIN ?? "https://alpharesearch.nyc";
export const DEFAULT_INSTALL_URL = process.env.ALPHA_RESEARCH_INSTALL_URL
  ?? "https://raw.githubusercontent.com/zenobia-pay/alpha-research/codex/initial-substrate/scripts/install_alpha_research.sh";
export const DEFAULT_INSTANCE_ROOT = process.env.DATASET_INSTANCE_ROOT
  ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/instances");
export const INGEST_SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../scripts/normalize_dataset.py");
export const DEFAULT_AGENT_MODEL = process.env.RESEARCH_AGENT_MODEL ?? "gpt-5";

export type SessionRecord = {
  origin: string;
  accessToken: string;
  createdAt: string;
};
