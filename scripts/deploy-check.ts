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

const readmePath = "ops/modal/README.md";
const readme = await readFile(readmePath, "utf8");
for (const required of ["Modal", "object storage", "canonical-public", "npm run build"]) {
  assert.ok(readme.includes(required), `${readmePath} should mention ${required}`);
}

assert.equal(await exists("apps/api/dist/server.js"), true, "API build output should exist after npm run build");
assert.equal(await exists("apps/frontend/dist/index.html"), true, "Frontend build output should exist after npm run build");

console.log("Deploy readiness check passed.");
