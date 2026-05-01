import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateRecords,
  buildTextCompatibleDocuments,
  queryDataset,
} from "@rprend/alpha-core";
import {
  countyEconomicsAdapter,
  tweetArchiveAdapter,
} from "../src/index.js";

test("tweet fixture supports text queries without making documents the primary model", async () => {
  const result = await queryDataset(tweetArchiveAdapter, { text: "housing permits" });
  assert.equal(result.records[0]?.id, "thread-housing");
  assert.equal(result.textHits[0]?.recordId, "thread-housing");
});

test("county fixture supports structured filtering and aggregation", async () => {
  const result = await queryDataset(countyEconomicsAdapter, {
    filters: [
      { field: "state", op: "eq", value: "CA" },
    ],
  });
  assert.equal(result.totalRecords, 2);

  const buckets = aggregateRecords(result.records, {
    groupBy: "state",
    measure: "housing_permits",
    op: "sum",
  });
  assert.deepEqual(buckets, [
    { key: "CA", value: 12425, count: 2 },
  ]);
});

test("tweet fixture can produce document-like compatibility views on demand", async () => {
  const records = await tweetArchiveAdapter.listRecords();
  const documents = buildTextCompatibleDocuments(tweetArchiveAdapter, records);
  assert.equal(documents.length, 3);
  assert.match(documents[1]?.text ?? "", /Labor markets can cool/);
});

