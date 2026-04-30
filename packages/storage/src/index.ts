import { createGunzip } from "node:zlib";
import {
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createInterface } from "node:readline";

import type {
  DatasetAdapter,
  DatasetAggregationBucket,
  DatasetAggregationRequest,
  DatasetDescriptor,
  DatasetFilter,
  DatasetFieldKind,
  DatasetQuery,
  DatasetQueryResult,
  DatasetRecord,
  DatasetTextHit,
  DatasetTextProjection,
  TextCompatibleDocument,
  DatasetValue,
} from "@zenobia-pay/alpha-core";
import { matchesFilter } from "@zenobia-pay/alpha-core";
import type { DatasetImplementationConfig } from "@zenobia-pay/alpha-implementations";

export interface DatasetInstanceBundle {
  implementation: DatasetImplementationConfig;
  descriptor: DatasetDescriptor;
  records: DatasetRecord[];
  textProjectionsByRecordId?: Record<string, DatasetTextProjection[]>;
}

export interface DatasetStorageProfile {
  canonicalStore: "filesystem" | "object_storage";
  catalog: "bundle_manifest" | "postgres";
  vectorIndex?: "none" | "qdrant";
  textIndex?: "none" | "opensearch" | "typesense" | "meilisearch";
  tabularFormat?: "jsonl" | "parquet" | "iceberg";
  textFormat?: "jsonl" | "parquet";
  textCompression?: "none" | "gzip" | "zstd";
}

export interface DatasetShardDescriptor {
  id: string;
  kind: "records" | "text_projections";
  path: string;
  format: "jsonl";
  compression: "none" | "gzip";
  rowCount: number;
  byteSize?: number;
  partitions?: Record<string, string>;
}

export interface DatasetInstanceManifest {
  version: 2;
  layout: "sharded";
  implementation: DatasetImplementationConfig;
  descriptor: DatasetDescriptor;
  storageProfile: DatasetStorageProfile;
  stats: {
    recordCount: number;
    textProjectionCount: number;
    shardCount: number;
  };
  samples?: {
    records?: DatasetRecord[];
  };
  shards: DatasetShardDescriptor[];
}

export interface DatasetInstanceSummary {
  id: string;
  productName: string;
  datasetId: string;
  displayName: string;
  description: string;
  recordCount: number;
  layout: "legacy_bundle" | "sharded";
  storageProfile?: DatasetStorageProfile;
}

type NormalizedInstance = {
  format: "legacy_bundle" | "sharded";
  implementation: DatasetImplementationConfig;
  descriptor: DatasetDescriptor;
  recordCount: number;
  textProjectionCount: number;
  storageProfile?: DatasetStorageProfile;
  samples?: DatasetRecord[];
  legacyBundle?: DatasetInstanceBundle;
  manifest?: DatasetInstanceManifest;
};

export interface WriteShardedInstanceOptions {
  shardRecordLimit?: number;
  compression?: "none" | "gzip";
  storageProfile?: Partial<DatasetStorageProfile>;
  sampleRecordLimit?: number;
}

function legacyBundlePath(rootDir: string, instanceId: string) {
  return join(rootDir, instanceId, "instance.json");
}

function manifestPath(rootDir: string, instanceId: string) {
  return join(rootDir, instanceId, "manifest.json");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 2);
}

function scoreProjection(query: string, projection: DatasetTextProjection): number {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return 0;
  }
  const haystack = `${projection.title}\n${projection.text}`.toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function buildExcerpt(text: string, query: string): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  const lower = normalized.toLowerCase();
  const token = tokenize(query)[0];
  if (!token) {
    return normalized.slice(0, 180);
  }
  const index = lower.indexOf(token);
  if (index === -1) {
    return normalized.slice(0, 180);
  }
  const start = Math.max(0, index - 60);
  return normalized.slice(start, start + 180);
}

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function inferPartitionValue(record: DatasetRecord, key: string): string | undefined {
  if (key === "entityType") {
    return record.entityType;
  }
  if (key === "observedYear" && record.observedAt) {
    return record.observedAt.slice(0, 4);
  }
  const value = record.values[key];
  if (Array.isArray(value)) {
    return value[0] == null ? undefined : String(value[0]);
  }
  return value == null ? undefined : String(value);
}

function choosePartitionKeys(descriptor: DatasetDescriptor): string[] {
  const keys: string[] = [];
  if (descriptor.entityTypes.length > 1) {
    keys.push("entityType");
  }
  if (descriptor.fields.some((field) => field.kind === "date")) {
    keys.push("observedYear");
  }
  const geographyField = descriptor.fields.find((field) => field.kind === "geography");
  if (geographyField) {
    keys.push(geographyField.key);
  }
  const categoryField = descriptor.fields.find((field) => field.kind === "category");
  if (categoryField) {
    keys.push(categoryField.key);
  }
  return keys.slice(0, 2);
}

async function writeShardFile(
  rootDir: string,
  instanceId: string,
  descriptor: DatasetShardDescriptor,
  rows: Array<DatasetRecord | DatasetTextProjection>,
): Promise<DatasetShardDescriptor> {
  const fullPath = join(rootDir, instanceId, descriptor.path);
  await mkdir(dirname(fullPath), { recursive: true });
  const serialized = `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  if (descriptor.compression === "gzip") {
    const { gzipSync } = await import("node:zlib");
    const output = gzipSync(serialized, { level: 6 });
    await writeFile(fullPath, output);
  } else {
    await writeFile(fullPath, serialized, "utf8");
  }
  const details = await stat(fullPath);
  return {
    ...descriptor,
    byteSize: details.size,
  };
}

async function *iterateJsonlShard<T>(
  absolutePath: string,
  compression: "none" | "gzip",
): AsyncGenerator<T> {
  const source = createReadStream(absolutePath);
  const input = compression === "gzip"
    ? source.pipe(createGunzip())
    : source;
  const reader = createInterface({
    input,
    crlfDelay: Infinity,
  });
  for await (const line of reader) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    yield JSON.parse(trimmed) as T;
  }
}

async function loadLegacyBundle(rootDir: string, instanceId: string): Promise<DatasetInstanceBundle> {
  const raw = await readFile(legacyBundlePath(rootDir, instanceId), "utf8");
  return JSON.parse(raw) as DatasetInstanceBundle;
}

async function loadManifest(rootDir: string, instanceId: string): Promise<DatasetInstanceManifest> {
  const raw = await readFile(manifestPath(rootDir, instanceId), "utf8");
  return JSON.parse(raw) as DatasetInstanceManifest;
}

async function loadNormalizedInstance(rootDir: string, instanceId: string): Promise<NormalizedInstance> {
  try {
    const manifest = await loadManifest(rootDir, instanceId);
    return {
      format: "sharded",
      implementation: manifest.implementation,
      descriptor: manifest.descriptor,
      recordCount: manifest.stats.recordCount,
      textProjectionCount: manifest.stats.textProjectionCount,
      storageProfile: manifest.storageProfile,
      samples: manifest.samples?.records,
      manifest,
    };
  } catch {
    const bundle = await loadLegacyBundle(rootDir, instanceId);
    const textProjectionCount = Object.values(bundle.textProjectionsByRecordId ?? {}).reduce(
      (sum, projections) => sum + projections.length,
      0,
    );
    return {
      format: "legacy_bundle",
      implementation: bundle.implementation,
      descriptor: bundle.descriptor,
      recordCount: bundle.records.length,
      textProjectionCount,
      samples: bundle.records.slice(0, 12),
      legacyBundle: bundle,
    };
  }
}

export async function writeInstanceBundle(rootDir: string, bundle: DatasetInstanceBundle): Promise<string> {
  const targetDir = join(rootDir, bundle.implementation.id);
  await mkdir(targetDir, { recursive: true });
  const targetPath = legacyBundlePath(rootDir, bundle.implementation.id);
  await writeFile(targetPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  return targetPath;
}

export async function writeShardedInstanceBundle(
  rootDir: string,
  bundle: DatasetInstanceBundle,
  options: WriteShardedInstanceOptions = {},
): Promise<string> {
  const shardRecordLimit = Math.max(1, options.shardRecordLimit ?? 50_000);
  const compression = options.compression ?? "gzip";
  const sampleRecordLimit = Math.max(1, options.sampleRecordLimit ?? 12);
  const partitionKeys = choosePartitionKeys(bundle.descriptor);
  const targetDir = join(rootDir, bundle.implementation.id);
  await mkdir(targetDir, { recursive: true });

  const recordShards: DatasetShardDescriptor[] = [];
  const recordChunks = chunkArray(bundle.records, shardRecordLimit);
  for (const [index, rows] of recordChunks.entries()) {
    const partitionEntries = partitionKeys
      .map((key) => [key, inferPartitionValue(rows[0]!, key)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));
    const partitions = Object.fromEntries(partitionEntries);
    const partitionPrefix = partitionEntries.length > 0
      ? `${partitionEntries.map(([key, value]) => `${key}=${sanitizePathValue(value)}`).join("/")}/`
      : "";
    const filename = `part-${String(index).padStart(5, "0")}.jsonl${compression === "gzip" ? ".gz" : ""}`;
    recordShards.push(await writeShardFile(rootDir, bundle.implementation.id, {
      id: `records-${index}`,
      kind: "records",
      path: `records/${partitionPrefix}${filename}`,
      format: "jsonl",
      compression,
      rowCount: rows.length,
      partitions: Object.keys(partitions).length > 0 ? partitions : undefined,
    }, rows));
  }

  const projectionRows = Object.values(bundle.textProjectionsByRecordId ?? {}).flat();
  const projectionShards: DatasetShardDescriptor[] = [];
  const projectionChunks = chunkArray(projectionRows, shardRecordLimit);
  for (const [index, rows] of projectionChunks.entries()) {
    const filename = `part-${String(index).padStart(5, "0")}.jsonl${compression === "gzip" ? ".gz" : ""}`;
    projectionShards.push(await writeShardFile(rootDir, bundle.implementation.id, {
      id: `text-projections-${index}`,
      kind: "text_projections",
      path: `text-projections/${filename}`,
      format: "jsonl",
      compression,
      rowCount: rows.length,
    }, rows));
  }

  const manifest: DatasetInstanceManifest = {
    version: 2,
    layout: "sharded",
    implementation: bundle.implementation,
    descriptor: bundle.descriptor,
    storageProfile: {
      canonicalStore: "object_storage",
      catalog: "postgres",
      vectorIndex: projectionRows.length > 0 ? "qdrant" : "none",
      textIndex: projectionRows.length > 0 ? "typesense" : "none",
      tabularFormat: "parquet",
      textFormat: "jsonl",
      textCompression: compression,
      ...options.storageProfile,
    },
    stats: {
      recordCount: bundle.records.length,
      textProjectionCount: projectionRows.length,
      shardCount: recordShards.length + projectionShards.length,
    },
    samples: {
      records: bundle.records.slice(0, sampleRecordLimit),
    },
    shards: [...recordShards, ...projectionShards],
  };

  const targetPath = manifestPath(rootDir, bundle.implementation.id);
  await writeFile(targetPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return targetPath;
}

function sanitizePathValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 64) || "unknown";
}

export async function loadInstanceBundle(rootDir: string, instanceId: string): Promise<DatasetInstanceBundle> {
  return loadLegacyBundle(rootDir, instanceId);
}

export async function loadInstanceManifest(rootDir: string, instanceId: string): Promise<DatasetInstanceManifest> {
  return loadManifest(rootDir, instanceId);
}

export async function listInstanceBundles(rootDir: string): Promise<DatasetInstanceSummary[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const summaries: DatasetInstanceSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const instance = await loadNormalizedInstance(rootDir, entry.name);
      summaries.push({
        id: instance.implementation.id,
        productName: instance.implementation.productName,
        datasetId: instance.descriptor.id,
        displayName: instance.descriptor.displayName,
        description: instance.descriptor.description,
        recordCount: instance.recordCount,
        layout: instance.format,
        storageProfile: instance.storageProfile,
      });
    } catch {
      // Ignore directories that do not contain a valid instance bundle.
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

async function *iterateRecords(rootDir: string, instanceId: string): AsyncGenerator<DatasetRecord> {
  const instance = await loadNormalizedInstance(rootDir, instanceId);
  if (instance.format === "legacy_bundle") {
    for (const record of instance.legacyBundle?.records ?? []) {
      yield record;
    }
    return;
  }
  const manifest = instance.manifest!;
  for (const shard of manifest.shards.filter((entry) => entry.kind === "records")) {
    yield* iterateJsonlShard<DatasetRecord>(join(rootDir, instanceId, shard.path), shard.compression);
  }
}

async function *iterateTextProjections(rootDir: string, instanceId: string): AsyncGenerator<DatasetTextProjection> {
  const instance = await loadNormalizedInstance(rootDir, instanceId);
  if (instance.format === "legacy_bundle") {
    for (const projections of Object.values(instance.legacyBundle?.textProjectionsByRecordId ?? {})) {
      for (const projection of projections) {
        yield projection;
      }
    }
    return;
  }
  const manifest = instance.manifest!;
  for (const shard of manifest.shards.filter((entry) => entry.kind === "text_projections")) {
    yield* iterateJsonlShard<DatasetTextProjection>(join(rootDir, instanceId, shard.path), shard.compression);
  }
}

export async function getInstanceBootstrap(rootDir: string, instanceId: string) {
  const instance = await loadNormalizedInstance(rootDir, instanceId);
  return {
    implementation: instance.implementation,
    descriptor: instance.descriptor,
    recordCount: instance.recordCount,
    sampleRecords: instance.samples ?? [],
    supportsTextSearch: instance.textProjectionCount > 0,
    layout: instance.format,
    storageProfile: instance.storageProfile,
    shardCount: instance.manifest?.stats.shardCount ?? 0,
  };
}

export async function getInstanceRecordById(
  rootDir: string,
  instanceId: string,
  recordId: string,
): Promise<{ record: DatasetRecord; textProjections: DatasetTextProjection[] } | null> {
  let foundRecord: DatasetRecord | null = null;
  for await (const record of iterateRecords(rootDir, instanceId)) {
    if (record.id === recordId) {
      foundRecord = record;
      break;
    }
  }
  if (!foundRecord) {
    return null;
  }
  const projections: DatasetTextProjection[] = [];
  for await (const projection of iterateTextProjections(rootDir, instanceId)) {
    if (projection.recordId === recordId) {
      projections.push(projection);
    }
  }
  return {
    record: foundRecord,
    textProjections: projections,
  };
}

export async function queryInstance(
  rootDir: string,
  instanceId: string,
  query: DatasetQuery,
): Promise<DatasetQueryResult> {
  const filters = query.filters ?? [];
  const limit = query.limit ?? 20;
  const matchedRecordIds = new Set<string>();
  const textHits: DatasetTextHit[] = [];

  if (query.text && query.text.trim().length > 0) {
    for await (const projection of iterateTextProjections(rootDir, instanceId)) {
      const score = scoreProjection(query.text, projection);
      if (score <= 0) {
        continue;
      }
      matchedRecordIds.add(projection.recordId);
      textHits.push({
        recordId: projection.recordId,
        projectionId: projection.id,
        score,
        excerpt: buildExcerpt(projection.text, query.text),
      });
    }
    textHits.sort((left, right) => right.score - left.score);
  }

  const records: DatasetRecord[] = [];
  let totalRecords = 0;
  for await (const record of iterateRecords(rootDir, instanceId)) {
    if (filters.some((filter) => !matchesFilter(record, filter))) {
      continue;
    }
    if (matchedRecordIds.size > 0 && !matchedRecordIds.has(record.id)) {
      continue;
    }
    totalRecords += 1;
    if (records.length < limit) {
      records.push(record);
    }
  }

  return {
    totalRecords,
    records,
    textHits: textHits.slice(0, limit),
  };
}

export async function aggregateInstance(
  rootDir: string,
  instanceId: string,
  request: DatasetAggregationRequest & { filters?: DatasetFilter[] },
): Promise<DatasetAggregationBucket[]> {
  const grouped = new Map<string, number[]>();
  for await (const record of iterateRecords(rootDir, instanceId)) {
    if ((request.filters ?? []).some((filter) => !matchesFilter(record, filter))) {
      continue;
    }
    const rawGroup = record.values[request.groupBy];
    const groupKey = Array.isArray(rawGroup) ? String(rawGroup[0] ?? "unknown") : String(rawGroup ?? "unknown");
    const rawMeasure = record.values[request.measure];
    const measure = Array.isArray(rawMeasure) ? rawMeasure[0] : rawMeasure;
    if (request.op !== "count" && typeof measure !== "number") {
      continue;
    }
    const bucket = grouped.get(groupKey) ?? [];
    bucket.push(typeof measure === "number" ? measure : 1);
    grouped.set(groupKey, bucket);
  }

  return [...grouped.entries()]
    .map(([key, values]) => {
      const count = values.length;
      const value = request.op === "count"
        ? count
        : request.op === "min"
          ? Math.min(...values)
          : request.op === "max"
            ? Math.max(...values)
            : request.op === "sum"
              ? values.reduce((sum, current) => sum + current, 0)
              : values.reduce((sum, current) => sum + current, 0) / count;
      return { key, value, count };
    })
    .sort((left, right) => right.value - left.value)
    .slice(0, request.limit ?? 10);
}

export async function buildTextCompatibleDocumentsForInstance(
  rootDir: string,
  instanceId: string,
  limit = 100,
): Promise<TextCompatibleDocument[]> {
  const records = new Map<string, DatasetRecord>();
  for await (const record of iterateRecords(rootDir, instanceId)) {
    if (records.size >= limit) {
      break;
    }
    records.set(record.id, record);
  }
  const projectionsByRecordId = new Map<string, DatasetTextProjection[]>();
  for await (const projection of iterateTextProjections(rootDir, instanceId)) {
    if (!records.has(projection.recordId)) {
      continue;
    }
    const bucket = projectionsByRecordId.get(projection.recordId) ?? [];
    bucket.push(projection);
    projectionsByRecordId.set(projection.recordId, bucket);
  }
  const documents: TextCompatibleDocument[] = [];
  for (const record of records.values()) {
    const projections = projectionsByRecordId.get(record.id) ?? [];
    if (projections.length === 0) {
      continue;
    }
    documents.push({
      id: record.id,
      title: record.title,
      text: projections.map((projection) => projection.text).join("\n\n"),
      sourceLabel: projections[0]?.sourceLabel ?? record.title,
      metadata: {
        ...record.values,
        observedAt: record.observedAt ?? null,
      },
    });
  }
  return documents;
}
