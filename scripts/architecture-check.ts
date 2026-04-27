import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

type Workspace = {
  name: string;
  root: string;
  allowedInternalDeps: string[];
};

const workspaces: Workspace[] = [
  { name: "@alpha-datasets/core", root: "packages/core", allowedInternalDeps: [] },
  { name: "@alpha-datasets/implementations", root: "packages/implementations", allowedInternalDeps: ["@alpha-datasets/core"] },
  { name: "@alpha-datasets/fixture", root: "packages/fixture", allowedInternalDeps: ["@alpha-datasets/core"] },
  { name: "@alpha-datasets/storage", root: "packages/storage", allowedInternalDeps: ["@alpha-datasets/core", "@alpha-datasets/implementations"] },
  { name: "@alpha-datasets/api", root: "apps/api", allowedInternalDeps: ["@alpha-datasets/core", "@alpha-datasets/storage"] },
  { name: "@alpha-datasets/frontend", root: "apps/frontend", allowedInternalDeps: [] },
  { name: "@alpha-datasets/ingest", root: "apps/ingest", allowedInternalDeps: ["@alpha-datasets/storage"] },
  { name: "@alpha-datasets/cli", root: "apps/cli", allowedInternalDeps: ["@alpha-datasets/core", "@alpha-datasets/fixture", "@alpha-datasets/storage"] },
];

async function walk(root: string): Promise<string[]> {
  const entries = await readdir(root);
  const files: string[] = [];
  for (const entry of entries) {
    if (["node_modules", "dist", ".git"].includes(entry)) {
      continue;
    }
    const path = join(root, entry);
    const metadata = await stat(path);
    if (metadata.isDirectory()) {
      files.push(...await walk(path));
    } else if (/\.(?:ts|tsx)$/u.test(path)) {
      files.push(path);
    }
  }
  return files;
}

function importedSpecifiers(source: string) {
  const specifiers = new Set<string>();
  for (const match of source.matchAll(/\bfrom\s+["']([^"']+)["']/gu)) {
    specifiers.add(match[1]!);
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu)) {
    specifiers.add(match[1]!);
  }
  return [...specifiers];
}

function workspaceForPath(path: string) {
  const normalized = path.split(sep).join("/");
  return workspaces.find((workspace) => normalized.startsWith(`${workspace.root}/`));
}

function workspaceForRelativeImport(fromFile: string, specifier: string) {
  if (!specifier.startsWith(".")) {
    return null;
  }
  const fromParts = fromFile.split(sep);
  fromParts.pop();
  const target = join(fromParts.join(sep), specifier).split(sep).join("/");
  return workspaces.find((workspace) => target.startsWith(`${workspace.root}/`)) ?? null;
}

const errors: string[] = [];
const files = await walk(".");

for (const file of files) {
  const owner = workspaceForPath(file);
  if (!owner) {
    continue;
  }
  if (file.split(sep).includes("test")) {
    continue;
  }
  const source = await readFile(file, "utf8");
  for (const specifier of importedSpecifiers(source)) {
    if (specifier.startsWith("@alpha-datasets/")) {
      const packageName = specifier.split("/").slice(0, 2).join("/");
      if (packageName !== owner.name && !owner.allowedInternalDeps.includes(packageName)) {
        errors.push(`${relative(".", file)} imports forbidden workspace ${specifier}`);
      }
    }
    const relativeWorkspace = workspaceForRelativeImport(file, specifier);
    if (relativeWorkspace && relativeWorkspace.name !== owner.name) {
      errors.push(`${relative(".", file)} uses relative import across workspace boundary: ${specifier}`);
    }
  }
}

const toolRegistrySource = await readFile("apps/cli/src/tool-registry.ts", "utf8");
assert.ok(!toolRegistrySource.includes("new RemoteApiClient"), "tool-registry.ts must stay metadata-only");
assert.ok(!toolRegistrySource.includes("async function"), "tool-registry.ts must not grow runtime logic");

if (errors.length > 0) {
  throw new Error(errors.join("\n"));
}

console.log(`Architecture check passed (${files.length} TypeScript files scanned).`);
