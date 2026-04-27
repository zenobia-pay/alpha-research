import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const serviceFiles = [
  "ops/digitalocean/systemd/alpha-research-api.service",
  "ops/digitalocean/systemd/alpha-research-frontend.service",
];

for (const file of serviceFiles) {
  assert.equal(await exists(file), true, `${file} should exist`);
  const content = await readFile(file, "utf8");
  assert.match(content, /ExecStart=/u, `${file} should define ExecStart`);
  assert.doesNotMatch(content, /node .*src\//u, `${file} should run built artifacts, not TypeScript source`);
}

const readme = await readFile("ops/digitalocean/README.md", "utf8");
for (const required of ["systemd", "PORT", "DATASET_INSTANCE_ROOT", "npm run build"]) {
  assert.ok(readme.includes(required), `ops/digitalocean/README.md should mention ${required}`);
}

assert.equal(await exists("apps/api/dist/server.js"), true, "API build output should exist after npm run build");
assert.equal(await exists("apps/frontend/dist/index.html"), true, "Frontend build output should exist after npm run build");

console.log("Deploy readiness check passed.");
