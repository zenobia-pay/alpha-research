import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { fileURLToPath } from "node:url";

import { aggregateRecords, queryDataset } from "@alpha-datasets/core";
import {
  createBundleAdapter,
  listInstanceBundles,
  loadInstanceBundle,
} from "@alpha-datasets/storage";

const app = new Hono();
const port = Number(process.env.PORT ?? "8787");
const instanceRoot = process.env.DATASET_INSTANCE_ROOT ?? fileURLToPath(new URL("../../../data/instances", import.meta.url));

app.use("/api/*", cors());

app.get("/api/health", (context) => context.json({
  ok: true,
  instanceRoot,
  now: new Date().toISOString(),
}));

app.get("/api/instances", async (context) => {
  const instances = await listInstanceBundles(instanceRoot);
  return context.json({ instances });
});

app.get("/api/instances/:instanceId/bootstrap", async (context) => {
  const bundle = await loadInstanceBundle(instanceRoot, context.req.param("instanceId"));
  return context.json({
    implementation: bundle.implementation,
    descriptor: bundle.descriptor,
    recordCount: bundle.records.length,
    sampleRecords: bundle.records.slice(0, 12),
    supportsTextSearch: Boolean(bundle.textProjectionsByRecordId && Object.keys(bundle.textProjectionsByRecordId).length > 0),
  });
});

app.get("/api/instances/:instanceId/records/:recordId", async (context) => {
  const bundle = await loadInstanceBundle(instanceRoot, context.req.param("instanceId"));
  const adapter = createBundleAdapter(bundle);
  const record = await adapter.getRecordById(context.req.param("recordId"));
  if (!record) {
    return context.json({ error: "Record not found" }, 404);
  }
  return context.json({
    record,
    textProjections: adapter.projectText?.(record) ?? [],
  });
});

app.post("/api/instances/:instanceId/query", async (context) => {
  const body = await context.req.json().catch(() => ({}));
  const bundle = await loadInstanceBundle(instanceRoot, context.req.param("instanceId"));
  const adapter = createBundleAdapter(bundle);
  const result = await queryDataset(adapter, {
    text: typeof body.text === "string" ? body.text : undefined,
    filters: Array.isArray(body.filters) ? body.filters : [],
    limit: typeof body.limit === "number" ? body.limit : 20,
  });
  return context.json(result);
});

app.post("/api/instances/:instanceId/aggregate", async (context) => {
  const body = await context.req.json();
  const bundle = await loadInstanceBundle(instanceRoot, context.req.param("instanceId"));
  return context.json({
    buckets: aggregateRecords(bundle.records, {
      groupBy: String(body.groupBy),
      measure: String(body.measure),
      op: body.op,
      limit: typeof body.limit === "number" ? body.limit : 10,
    }),
  });
});

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`alpha-datasets api listening on http://localhost:${info.port}`);
});
