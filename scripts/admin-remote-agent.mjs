import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const defaultOrigin = process.env.ALPHA_RESEARCH_ORIGIN ?? "https://alpharesearch.nyc";
export const adminTokenPath = process.env.ALPHA_RESEARCH_ADMIN_TOKEN_PATH ?? join(homedir(), ".codex", "secrets.env");

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function argValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  const value = argv[index + 1];
  assert(value && !value.startsWith("--"), `Missing value for ${name}`);
  return value;
}

export function readAdminToken() {
  if (process.env.ALPHA_RESEARCH_ADMIN_TOKEN) return process.env.ALPHA_RESEARCH_ADMIN_TOKEN;
  if (!existsSync(adminTokenPath)) return null;
  const envText = readFileSync(adminTokenPath, "utf8");
  const match = envText.match(/^ALPHA_RESEARCH_ADMIN_TOKEN=(.*)$/mu);
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") || null;
}

export async function postAdminJson(path, body, origin = defaultOrigin) {
  const token = readAdminToken();
  assert(token, `Missing ALPHA_RESEARCH_ADMIN_TOKEN. Store it with ~/.codex/scripts/ask-secret.sh ALPHA_RESEARCH_ADMIN_TOKEN ${adminTokenPath} "Enter Alpha Research admin token"`);
  const endpoint = new URL(path, origin).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const canonicalHint = response.status === 405 && path === "/api/admin/remote-agent-executions"
      ? " Hidden remote-agent execution POST is unavailable; canonical dataset jobs must use /api/admin/canonical-datasets/* endpoints and must not fall back to /api/cli/datasets/:datasetId/runs."
      : "";
    throw new Error(`Admin request failed (${response.status}) for ${endpoint}: ${text || "{}"}${canonicalHint}`);
  }
  return { endpoint, body: parsed };
}

export function executionIdFromResponse(payload) {
  return payload?.execution?.id ?? payload?.remoteAgentExecution?.id ?? payload?.id ?? null;
}

export function adminExecutionStatusUrl(executionId, origin = defaultOrigin) {
  if (!executionId) return null;
  return new URL(`/api/admin/remote-agent-executions/${encodeURIComponent(executionId)}`, origin).toString();
}

export function adminExecutionArtifactsUrl(executionId, origin = defaultOrigin) {
  if (!executionId) return null;
  return new URL(`/api/admin/remote-agent-executions/${encodeURIComponent(executionId)}/artifacts`, origin).toString();
}
