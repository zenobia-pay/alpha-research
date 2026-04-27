import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const markdownFiles = [
  "AGENTS.md",
  "README.md",
  "docs/ARCHITECTURE.md",
  "docs/RUN_LIFECYCLE.md",
  "docs/HARNESS.md",
  "docs/QUALITY.md",
  "docs/AGENT_WORKFLOWS.md",
];

async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function extractBacktickPaths(markdown: string) {
  const paths = new Set<string>();
  const pattern = /`([^`\n]+\.(?:md|ts|tsx|json|py|sh|service|yml|yaml))`/gu;
  for (const match of markdown.matchAll(pattern)) {
    const candidate = match[1]!;
    if (!candidate.startsWith(".") && !candidate.startsWith("/") && !candidate.includes("://") && !/\s/u.test(candidate)) {
      paths.add(candidate);
    }
  }
  return [...paths];
}

function extractCommands(markdown: string) {
  const commands = new Set<string>();
  for (const match of markdown.matchAll(/\bnpm run ([a-z0-9:_-]+)/gu)) {
    commands.add(match[1]!);
  }
  return [...commands];
}

const rootPackage = await readJson<{ scripts: Record<string, string> }>("package.json");
const agentGuide = await readFile("AGENTS.md", "utf8");

for (const doc of markdownFiles) {
  assert.equal(await fileExists(doc), true, `${doc} should exist`);
  const content = await readFile(doc, "utf8");
  assert.ok(content.trim().length > 200, `${doc} should contain useful context`);
}

for (const path of extractBacktickPaths(agentGuide)) {
  assert.equal(await fileExists(path), true, `AGENTS.md references missing path ${path}`);
}

for (const command of extractCommands(agentGuide)) {
  assert.ok(rootPackage.scripts[command], `AGENTS.md references missing npm script ${command}`);
}

for (const doc of ["docs/ARCHITECTURE.md", "docs/RUN_LIFECYCLE.md", "docs/HARNESS.md"]) {
  assert.ok(agentGuide.includes(doc), `AGENTS.md should link ${doc}`);
}

const runLifecycle = await readFile("docs/RUN_LIFECYCLE.md", "utf8");
const runsSource = await readFile("apps/cli/src/runs.ts", "utf8");
for (const status of ["queued", "booting", "running", "ready", "completed", "succeeded", "failed", "error", "cancelled", "canceled"]) {
  assert.ok(runLifecycle.includes(status), `RUN_LIFECYCLE.md should document ${status}`);
  if (["queued", "booting", "running"].includes(status)) {
    continue;
  }
  assert.ok(runsSource.includes(`"${status}"`), `apps/cli/src/runs.ts should classify terminal status ${status}`);
}

console.log(`Docs check passed (${markdownFiles.length} docs).`);
