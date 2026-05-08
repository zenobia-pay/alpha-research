import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.SMOKE_API_PORT ?? "18787");
const api = spawn(process.execPath, ["--import", "tsx", "apps/api/src/server.ts"], {
  env: {
    ...process.env,
    PORT: String(port),
    DATASET_INSTANCE_ROOT: process.env.DATASET_INSTANCE_ROOT ?? "data/instances",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
api.stderr.on("data", (chunk) => {
  stderr += String(chunk);
});

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  assert.equal(response.ok, true, `${path} returned ${response.status}`);
  return response.json() as Promise<T>;
}

async function waitForHealth() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      return await fetchJson<{ ok: boolean }>("/api/health");
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`API did not become healthy. stderr:\n${stderr}`);
}

try {
  const health = await waitForHealth();
  assert.equal(health.ok, true);
  const instances = await fetchJson<{ instances: Array<{ id: string }> }>("/api/instances");
  if (instances.instances.length === 0) {
    console.log("Local smoke check passed (0 local instances).");
    process.exit(0);
  }
  const first = instances.instances[0]!;
  const bootstrap = await fetchJson<{ recordCount: number; sampleRecords: unknown[] }>(`/api/instances/${first.id}/bootstrap`);
  assert.ok(bootstrap.recordCount > 0, "expected records in bootstrap payload");
  assert.ok(bootstrap.sampleRecords.length > 0, "expected sample records");
  console.log(`Local smoke check passed (${instances.instances.length} instances, first=${first.id}).`);
} finally {
  api.kill("SIGTERM");
}
