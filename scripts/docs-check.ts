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

async function readTextIfExists(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
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

function productTestDocSlug(name: string) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function productTestDocPath(name: string) {
  return `docs/product-tests/${productTestDocSlug(name)}.md`;
}

async function assertProductTestDoc(name: string) {
  const path = productTestDocPath(name);
  const content = await readTextIfExists(path);
  assert.ok(content, `Missing product test doc ${path} for "${name}"`);
  assert.ok(productTestBriefing.includes(path.replace(/^docs\//u, "")), `docs/PRODUCT_TEST_BRIEFING.md should link ${path}`);
  assert.ok(content.includes(`# ${name}`), `${path} should start with or include heading "# ${name}"`);
  for (const section of ["## Product Use", "## Actions Taken", "## Assertions Made"]) {
    assert.ok(content.includes(section), `${path} should include ${section}`);
  }
  assert.ok(content.trim().length > 250, `${path} should explain the product behavior in useful detail`);
  return path;
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
  return /^apps\/cli\/test\/(?:agent-harness|registry|golden|symphony-cases)\.test\.ts$/u.test(path)
    || /^apps\/cli\/test\/golden\/.+\.json$/u.test(path)
    || /^apps\/cli\/test\/symphony-cases\/.+\.json$/u.test(path)
    || /^scripts\/product-e2e-(?:econ|tweets)\.ts$/u.test(path);
}

async function exactProductDocsForChangedFile(path: string) {
  if (/^apps\/cli\/test\/golden\/.+\.json$/u.test(path)) {
    const fixture = await readJson<{ name: string }>(path);
    return [productTestDocPath(`golden: ${fixture.name}`)];
  }
  if (/^apps\/cli\/test\/symphony-cases\/.+\.json$/u.test(path)) {
    const fixture = await readJson<{ name: string }>(path);
    return [productTestDocPath(`symphony case: ${fixture.name}`)];
  }
  if (path === "scripts/product-e2e-tweets.ts") {
    return [productTestDocPath("test:slow:tweets")];
  }
  if (path === "scripts/product-e2e-econ.ts") {
    return [
      "test:slow:econ",
      "test:slow:econ:discover",
      "test:slow:econ:normalization-plan",
      "test:slow:econ:normalization-execution",
      "test:slow:econ:environment",
      "test:slow:econ:hypothesis",
    ].map(productTestDocPath);
  }
  return [];
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

const expectedProductTestDocPaths = new Set<string>();

for (const scriptName of Object.keys(rootPackage.scripts).filter((name) => name === "test:slow" || name.startsWith("test:slow:"))) {
  expectedProductTestDocPaths.add(await assertProductTestDoc(scriptName));
}

for (const testFile of ["apps/cli/test/agent-harness.test.ts", "apps/cli/test/registry.test.ts"]) {
  const source = await readFile(testFile, "utf8");
  for (const match of source.matchAll(/\btest\("([^"]+)"/gu)) {
    const testName = match[1]!;
    expectedProductTestDocPaths.add(await assertProductTestDoc(testName));
  }
}

for (const filename of await readdir("apps/cli/test/golden")) {
  if (!filename.endsWith(".json")) continue;
  const fixture = await readJson<{ name: string }>(`apps/cli/test/golden/${filename}`);
  expectedProductTestDocPaths.add(await assertProductTestDoc(`golden: ${fixture.name}`));
}

for (const filename of await readdir("apps/cli/test/symphony-cases")) {
  if (!filename.endsWith(".json")) continue;
  const fixture = await readJson<{ name: string }>(`apps/cli/test/symphony-cases/${filename}`);
  expectedProductTestDocPaths.add(await assertProductTestDoc(`symphony case: ${fixture.name}`));
}

for (const filename of await readdir("docs/product-tests")) {
  if (!filename.endsWith(".md")) continue;
  const path = `docs/product-tests/${filename}`;
  assert.ok(expectedProductTestDocPaths.has(path), `${path} does not correspond to a current product test`);
}

const changedFiles = await changedFilesForThisCheck();
if (changedFiles) {
  const changedProductDocs = changedFiles.filter((path) => path.startsWith("docs/product-tests/") && path.endsWith(".md"));
  const exactRequiredDocs = (await Promise.all(changedFiles.map(exactProductDocsForChangedFile))).flat();
  const missingExactDocs = exactRequiredDocs.filter((path) => !changedFiles.includes(path));
  const broadProductTestContractChanged = changedFiles.some((path) =>
    /^apps\/cli\/test\/(?:agent-harness|registry|golden|symphony-cases)\.test\.ts$/u.test(path),
  );
  assert.ok(
    missingExactDocs.length === 0,
    [
      "The corresponding per-test product docs must be updated when product test contracts change.",
      "Changed product test contract files:",
      ...changedFiles.filter(isProductTestContractFile).map((path) => `- ${path}`),
      "Missing changed product docs:",
      ...missingExactDocs.map((path) => `- ${path}`),
    ].join("\n"),
  );
  assert.ok(
    !broadProductTestContractChanged || changedProductDocs.length > 0,
    [
      "At least one per-test product doc must be updated when monolithic product test files change.",
      "Changed product test files:",
      ...changedFiles.filter((path) => /^apps\/cli\/test\/(?:agent-harness|registry|golden|symphony-cases)\.test\.ts$/u.test(path)).map((path) => `- ${path}`),
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
