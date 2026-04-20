import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  DatasetAdapter,
  DatasetDescriptor,
  DatasetRecord,
  DatasetTextProjection,
} from "@alpha-datasets/core";
import type { DatasetImplementationConfig } from "@alpha-datasets/implementations";

export interface DatasetInstanceBundle {
  implementation: DatasetImplementationConfig;
  descriptor: DatasetDescriptor;
  records: DatasetRecord[];
  textProjectionsByRecordId?: Record<string, DatasetTextProjection[]>;
}

export interface DatasetInstanceSummary {
  id: string;
  productName: string;
  datasetId: string;
  displayName: string;
  description: string;
  recordCount: number;
}

function bundlePath(rootDir: string, instanceId: string) {
  return join(rootDir, instanceId, "instance.json");
}

export async function writeInstanceBundle(rootDir: string, bundle: DatasetInstanceBundle): Promise<string> {
  const targetDir = join(rootDir, bundle.implementation.id);
  await mkdir(targetDir, { recursive: true });
  const targetPath = bundlePath(rootDir, bundle.implementation.id);
  await writeFile(targetPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  return targetPath;
}

export async function loadInstanceBundle(rootDir: string, instanceId: string): Promise<DatasetInstanceBundle> {
  const raw = await readFile(bundlePath(rootDir, instanceId), "utf8");
  return JSON.parse(raw) as DatasetInstanceBundle;
}

export async function listInstanceBundles(rootDir: string): Promise<DatasetInstanceSummary[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const summaries: DatasetInstanceSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const bundle = await loadInstanceBundle(rootDir, entry.name);
      summaries.push({
        id: bundle.implementation.id,
        productName: bundle.implementation.productName,
        datasetId: bundle.descriptor.id,
        displayName: bundle.descriptor.displayName,
        description: bundle.descriptor.description,
        recordCount: bundle.records.length,
      });
    } catch {
      // Ignore directories that do not contain a valid bundle.
    }
  }
  return summaries.sort((left, right) => left.productName.localeCompare(right.productName));
}

export function createBundleAdapter(bundle: DatasetInstanceBundle): DatasetAdapter {
  return {
    descriptor: bundle.descriptor,
    async listRecords() {
      return bundle.records;
    },
    async getRecordById(recordId) {
      return bundle.records.find((record) => record.id === recordId) ?? null;
    },
    projectText(record) {
      return bundle.textProjectionsByRecordId?.[record.id] ?? [];
    },
  };
}

export function buildBundleFromAdapter(
  implementation: DatasetImplementationConfig,
  adapter: DatasetAdapter,
  records: DatasetRecord[],
): DatasetInstanceBundle {
  const projections = adapter.projectText
    ? Object.fromEntries(
        records
          .map((record) => [record.id, adapter.projectText?.(record) ?? []] as const)
          .filter(([, value]) => value.length > 0),
      )
    : {};
  return {
    implementation,
    descriptor: adapter.descriptor,
    records,
    textProjectionsByRecordId: Object.keys(projections).length > 0 ? projections : undefined,
  };
}
