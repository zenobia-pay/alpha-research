import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateRecords,
  buildTextCompatibleDocuments,
  matchesFilter,
  type DatasetAdapter,
  type DatasetRecord,
} from "../src/index.js";

const records: DatasetRecord[] = [
  {
    id: "a",
    datasetId: "fixture",
    entityType: "observation",
    title: "Alpha",
    values: {
      state: "CA",
      population: 10,
      tags: ["west", "coastal"],
    },
  },
  {
    id: "b",
    datasetId: "fixture",
    entityType: "observation",
    title: "Beta",
    values: {
      state: "NY",
      population: 20,
      tags: ["east"],
    },
  },
];

test("matchesFilter handles scalar and repeated values", () => {
  assert.equal(matchesFilter(records[0], { field: "state", op: "eq", value: "CA" }), true);
  assert.equal(matchesFilter(records[0], { field: "tags", op: "contains", value: "coast" }), true);
  assert.equal(matchesFilter(records[1], { field: "population", op: "gte", value: 15 }), true);
});

test("aggregateRecords groups numeric measures", () => {
  const buckets = aggregateRecords(records, {
    groupBy: "state",
    measure: "population",
    op: "sum",
  });
  assert.deepEqual(buckets, [
    { key: "NY", value: 20, count: 1 },
    { key: "CA", value: 10, count: 1 },
  ]);
});

test("buildTextCompatibleDocuments converts text projections into document-like views", () => {
  const adapter: DatasetAdapter = {
    descriptor: {
      id: "fixture",
      displayName: "Fixture",
      description: "Fixture dataset",
      entityTypes: ["observation"],
      fields: [],
      capabilities: {
        textProjections: true,
        structuredFilters: true,
        aggregations: true,
        artifacts: false,
      },
    },
    async listRecords() {
      return records;
    },
    async getRecordById(recordId) {
      return records.find((record) => record.id === recordId) ?? null;
    },
    projectText(record) {
      return [{
        id: `${record.id}-text`,
        recordId: record.id,
        title: record.title,
        text: `Record ${record.title}`,
        sourceLabel: "fixture",
      }];
    },
  };

  assert.deepEqual(buildTextCompatibleDocuments(adapter, records), [
    {
      id: "a-text",
      title: "Alpha",
      text: "Record Alpha",
      sourceLabel: "fixture",
      metadata: {
        datasetId: "fixture",
        recordId: "a",
        entityType: "observation",
      },
    },
    {
      id: "b-text",
      title: "Beta",
      text: "Record Beta",
      sourceLabel: "fixture",
      metadata: {
        datasetId: "fixture",
        recordId: "b",
        entityType: "observation",
      },
    },
  ]);
});

