export type DatasetPrimitive = string | number | boolean | null;
export type DatasetValue = DatasetPrimitive | DatasetPrimitive[];

export type DatasetFieldKind =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "category"
  | "geography"
  | "json";

export interface DatasetField {
  key: string;
  label: string;
  kind: DatasetFieldKind;
  description?: string;
  repeated?: boolean;
}

export interface DatasetMeasure {
  key: string;
  label: string;
  unit?: string;
  description?: string;
}

export interface DatasetArtifact {
  id: string;
  recordId?: string;
  kind: string;
  mimeType: string;
  uri?: string;
  textContent?: string;
  metadata?: Record<string, DatasetValue>;
}

export interface DatasetDescriptor {
  id: string;
  displayName: string;
  description: string;
  entityTypes: string[];
  fields: DatasetField[];
  measures?: DatasetMeasure[];
  capabilities: {
    textProjections: boolean;
    structuredFilters: boolean;
    aggregations: boolean;
    artifacts: boolean;
    timeSeries?: boolean;
    geography?: boolean;
  };
}

export interface DatasetRecord {
  id: string;
  datasetId: string;
  entityType: string;
  title: string;
  summary?: string | null;
  observedAt?: string | null;
  values: Record<string, DatasetValue>;
  tags?: string[];
  artifacts?: DatasetArtifact[];
}

export interface DatasetTextProjection {
  id: string;
  recordId: string;
  title: string;
  text: string;
  sourceLabel: string;
  metadata?: Record<string, DatasetValue>;
}

export interface TextCompatibleDocument {
  id: string;
  title: string;
  text: string;
  sourceLabel: string;
  metadata: Record<string, DatasetValue>;
}

export type DatasetFilterOperator = "eq" | "in" | "contains" | "gte" | "lte";

export interface DatasetFilter {
  field: string;
  op: DatasetFilterOperator;
  value: DatasetPrimitive | DatasetPrimitive[];
}

export interface DatasetAggregationRequest {
  groupBy: string;
  measure: string;
  op?: "sum" | "avg" | "min" | "max" | "count";
  limit?: number;
}

export interface DatasetAggregationBucket {
  key: string;
  value: number;
  count: number;
}

export interface DatasetTextHit {
  recordId: string;
  projectionId: string;
  score: number;
  excerpt: string;
}

export interface DatasetQuery {
  text?: string;
  filters?: DatasetFilter[];
  limit?: number;
}

export interface DatasetQueryResult {
  totalRecords: number;
  records: DatasetRecord[];
  textHits: DatasetTextHit[];
}

export interface DatasetAdapter {
  descriptor: DatasetDescriptor;
  listRecords(): Promise<DatasetRecord[]>;
  getRecordById(recordId: string): Promise<DatasetRecord | null>;
  projectText?(record: DatasetRecord): DatasetTextProjection[];
}

function comparePrimitive(left: DatasetPrimitive, right: DatasetPrimitive): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return -1;
  }
  if (right === null) {
    return 1;
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

function toValueList(value: DatasetValue | undefined): DatasetPrimitive[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined ? [] : [value];
}

export function matchesFilter(record: DatasetRecord, filter: DatasetFilter): boolean {
  const values = toValueList(record.values[filter.field]);
  const compareValues = Array.isArray(filter.value) ? filter.value : [filter.value];
  switch (filter.op) {
    case "eq":
      return values.some((value) => compareValues.some((candidate) => value === candidate));
    case "in":
      return values.some((value) => compareValues.includes(value));
    case "contains":
      return values.some((value) => {
        if (value === null) {
          return false;
        }
        const haystack = String(value).toLowerCase();
        return compareValues.some((candidate) => candidate !== null && haystack.includes(String(candidate).toLowerCase()));
      });
    case "gte":
      return values.some((value) => comparePrimitive(value, compareValues[0] ?? null) >= 0);
    case "lte":
      return values.some((value) => comparePrimitive(value, compareValues[0] ?? null) <= 0);
    default:
      return false;
  }
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

export async function queryDataset(
  adapter: DatasetAdapter,
  query: DatasetQuery,
): Promise<DatasetQueryResult> {
  const allRecords = await adapter.listRecords();
  const filtered = (query.filters ?? []).reduce(
    (records, filter) => records.filter((record) => matchesFilter(record, filter)),
    allRecords,
  );

  let textHits: DatasetTextHit[] = [];
  let records = filtered;
  if (query.text && adapter.projectText) {
    textHits = filtered
      .flatMap((record) => adapter.projectText?.(record) ?? [])
      .map((projection) => ({
        recordId: projection.recordId,
        projectionId: projection.id,
        score: scoreProjection(query.text ?? "", projection),
        excerpt: buildExcerpt(projection.text, query.text ?? ""),
      }))
      .filter((hit) => hit.score > 0)
      .sort((left, right) => right.score - left.score);
    const recordIds = new Set(textHits.map((hit) => hit.recordId));
    records = filtered.filter((record) => recordIds.has(record.id));
  }

  const limit = query.limit ?? 20;
  return {
    totalRecords: records.length,
    records: records.slice(0, limit),
    textHits: textHits.slice(0, limit),
  };
}

export function aggregateRecords(
  records: DatasetRecord[],
  request: DatasetAggregationRequest,
): DatasetAggregationBucket[] {
  const grouped = new Map<string, number[]>();
  for (const record of records) {
    const rawGroup = record.values[request.groupBy];
    const groupKey = Array.isArray(rawGroup) ? String(rawGroup[0] ?? "unknown") : String(rawGroup ?? "unknown");
    const rawMeasure = record.values[request.measure];
    const measure = Array.isArray(rawMeasure) ? rawMeasure[0] : rawMeasure;
    if (typeof measure !== "number") {
      continue;
    }
    const bucket = grouped.get(groupKey) ?? [];
    bucket.push(measure);
    grouped.set(groupKey, bucket);
  }

  const op = request.op ?? "sum";
  const buckets = [...grouped.entries()].map(([key, values]) => {
    let value: number;
    switch (op) {
      case "avg":
        value = values.reduce((sum, item) => sum + item, 0) / values.length;
        break;
      case "min":
        value = Math.min(...values);
        break;
      case "max":
        value = Math.max(...values);
        break;
      case "count":
        value = values.length;
        break;
      case "sum":
      default:
        value = values.reduce((sum, item) => sum + item, 0);
        break;
    }
    return { key, value, count: values.length };
  });

  return buckets
    .sort((left, right) => right.value - left.value)
    .slice(0, request.limit ?? 10);
}

export function buildTextCompatibleDocuments(
  adapter: DatasetAdapter,
  records: DatasetRecord[],
): TextCompatibleDocument[] {
  if (!adapter.projectText) {
    return [];
  }
  return records.flatMap((record) =>
    (adapter.projectText?.(record) ?? []).map((projection) => ({
      id: projection.id,
      title: projection.title,
      text: projection.text,
      sourceLabel: projection.sourceLabel,
      metadata: {
        datasetId: record.datasetId,
        recordId: record.id,
        entityType: record.entityType,
        ...(projection.metadata ?? {}),
      },
    })),
  );
}

export function describeDataset(adapter: DatasetAdapter): string {
  const descriptor = adapter.descriptor;
  const measureList = descriptor.measures?.map((measure) => measure.key).join(", ") ?? "none";
  return [
    `${descriptor.displayName} (${descriptor.id})`,
    descriptor.description,
    `entityTypes: ${descriptor.entityTypes.join(", ")}`,
    `fields: ${descriptor.fields.map((field) => field.key).join(", ")}`,
    `measures: ${measureList}`,
    `capabilities: ${JSON.stringify(descriptor.capabilities)}`,
  ].join("\n");
}

