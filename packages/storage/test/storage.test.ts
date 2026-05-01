import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildBundleFromAdapter, getInstanceBootstrap, queryInstance, writeShardedInstanceBundle } from "../src/index.js";
import { getFixtureAdapter } from "@rprend/alpha-fixture";

test("writeShardedInstanceBundle writes manifest-backed instances that can be queried lazily", async () => {
  const root = await mkdtemp(join(tmpdir(), "alpha-research-storage-"));
  const adapter = getFixtureAdapter("tweets");
  assert.ok(adapter);
  const records = await adapter.listRecords();
  const bundle = buildBundleFromAdapter({
    id: "fixture-tweets-sharded",
    productName: "Fixture Tweets",
    siteName: "fixture tweets",
    siteDescription: "Fixture dataset",
    datasetId: "tweets",
    datasetLabelSingular: "thread",
    datasetLabelPlural: "threads",
    heroTitle: "Fixture Tweets",
    heroSubtitle: "Fixture dataset",
    searchPlaceholder: "Search threads...",
    theme: {
      accent: "#000000",
      accentStrong: "#111111",
      surface: "#ffffff",
      surfaceAlt: "#f5f5f5",
      text: "#111111",
      textMuted: "#555555",
      line: "#dddddd",
    },
  }, adapter, records);

  const manifestPath = await writeShardedInstanceBundle(root, bundle, { shardRecordLimit: 1 });
  assert.ok(manifestPath.endsWith("/manifest.json"));

  const bootstrap = await getInstanceBootstrap(root, "fixture-tweets-sharded");
  assert.equal(bootstrap.layout, "sharded");
  assert.equal(bootstrap.recordCount, records.length);
  assert.ok((bootstrap.shardCount ?? 0) >= records.length);

  const result = await queryInstance(root, "fixture-tweets-sharded", { text: "rent", limit: 5 });
  assert.ok(result.totalRecords >= 1);
  assert.ok(result.textHits.length >= 1);
});
