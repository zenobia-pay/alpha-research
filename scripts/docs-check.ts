import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readdir, readFile } from "node:fs/promises";

const markdownFiles = [
  "AGENTS.md",
  "README.md",
  "docs/ARCHITECTURE.md",
  "docs/RUN_LIFECYCLE.md",
  "docs/HARNESS.md",
  "docs/PRODUCT_TEST_BRIEFING.md",
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

function git(args: string[]) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function changedFilesFromEnv() {
  const explicit = process.env.DOCS_CHECK_CHANGED_FILES;
  if (!explicit) return null;
  return explicit.split(/[\n,]/u).map((entry) => entry.trim()).filter(Boolean);
}

async function changedFilesFromGitHubEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return null;
  const event = JSON.parse(await readFile(eventPath, "utf8")) as {
    before?: string;
    pull_request?: { base?: { sha?: string } };
  };
  return event.pull_request?.base?.sha ?? event.before ?? null;
}

async function changedFilesForThisCheck() {
  const explicit = changedFilesFromEnv();
  if (explicit) return explicit;

  const eventBase = await changedFilesFromGitHubEvent();
  if (eventBase && !/^0+$/u.test(eventBase)) {
    try {
      return git(["diff", "--name-only", `${eventBase}...HEAD`]).split("\n").filter(Boolean);
    } catch {
      return null;
    }
  }

  try {
    const base = git(["merge-base", "origin/main", "HEAD"]);
    return git(["diff", "--name-only", `${base}...HEAD`]).split("\n").filter(Boolean);
  } catch {
    return null;
  }
}

function isProductTestContractFile(path: string) {
  return path === "package.json"
    || /^apps\/cli\/test\/(?:agent-harness|registry|golden|symphony-cases)\.test\.ts$/u.test(path)
    || /^apps\/cli\/test\/golden\/.+\.json$/u.test(path)
    || /^apps\/cli\/test\/symphony-cases\/.+\.json$/u.test(path)
    || /^scripts\/product-e2e-(?:econ|tweets)\.ts$/u.test(path);
}

const rootPackage = await readJson<{ scripts: Record<string, string> }>("package.json");
const agentGuide = await readFile("AGENTS.md", "utf8");
const productTestBriefing = await readFile("docs/PRODUCT_TEST_BRIEFING.md", "utf8");

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

for (const scriptName of Object.keys(rootPackage.scripts).filter((name) => name === "test:slow" || name.startsWith("test:slow:"))) {
  assert.ok(productTestBriefing.includes(scriptName), `docs/PRODUCT_TEST_BRIEFING.md should document npm script ${scriptName}`);
}

for (const testFile of ["apps/cli/test/agent-harness.test.ts", "apps/cli/test/registry.test.ts"]) {
  const source = await readFile(testFile, "utf8");
  for (const match of source.matchAll(/\btest\("([^"]+)"/gu)) {
    const testName = match[1]!;
    assert.ok(productTestBriefing.includes(testName), `docs/PRODUCT_TEST_BRIEFING.md should document test "${testName}" from ${testFile}`);
  }
}

for (const filename of await readdir("apps/cli/test/golden")) {
  if (!filename.endsWith(".json")) continue;
  const fixture = await readJson<{ name: string }>(`apps/cli/test/golden/${filename}`);
  assert.ok(productTestBriefing.includes(`golden: ${fixture.name}`), `docs/PRODUCT_TEST_BRIEFING.md should document golden fixture ${filename}`);
}

for (const filename of await readdir("apps/cli/test/symphony-cases")) {
  if (!filename.endsWith(".json")) continue;
  const fixture = await readJson<{ name: string }>(`apps/cli/test/symphony-cases/${filename}`);
  assert.ok(productTestBriefing.includes(`symphony case: ${fixture.name}`), `docs/PRODUCT_TEST_BRIEFING.md should document Symphony case ${filename}`);
}

const changedFiles = await changedFilesForThisCheck();
if (changedFiles) {
  const productTestContractChanged = changedFiles.some(isProductTestContractFile);
  const productBriefingChanged = changedFiles.includes("docs/PRODUCT_TEST_BRIEFING.md");
  assert.ok(
    !productTestContractChanged || productBriefingChanged,
    [
      "docs/PRODUCT_TEST_BRIEFING.md must be updated when product test contracts change.",
      "Changed product test contract files:",
      ...changedFiles.filter(isProductTestContractFile).map((path) => `- ${path}`),
    ].join("\n"),
  );
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
