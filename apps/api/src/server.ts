import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { fileURLToPath } from "node:url";

import {
  aggregateInstance,
  getInstanceBootstrap,
  getInstanceRecordById,
  listInstanceBundles,
  queryInstance,
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
  const bootstrap = await getInstanceBootstrap(instanceRoot, context.req.param("instanceId"));
  return context.json(bootstrap);
});

app.get("/api/instances/:instanceId/records/:recordId", async (context) => {
  const payload = await getInstanceRecordById(
    instanceRoot,
    context.req.param("instanceId"),
    context.req.param("recordId"),
  );
  if (!payload) {
    return context.json({ error: "Record not found" }, 404);
  }
  return context.json(payload);
});

app.post("/api/instances/:instanceId/query", async (context) => {
  const body = await context.req.json().catch(() => ({}));
  const result = await queryInstance(instanceRoot, context.req.param("instanceId"), {
    text: typeof body.text === "string" ? body.text : undefined,
    filters: Array.isArray(body.filters) ? body.filters : [],
    limit: typeof body.limit === "number" ? body.limit : 20,
  });
  return context.json(result);
});

app.post("/api/instances/:instanceId/aggregate", async (context) => {
  const body = await context.req.json();
  return context.json({
    buckets: await aggregateInstance(instanceRoot, context.req.param("instanceId"), {
      groupBy: String(body.groupBy),
      measure: String(body.measure),
      op: body.op,
      limit: typeof body.limit === "number" ? body.limit : 10,
      filters: Array.isArray(body.filters) ? body.filters : [],
    }),
  });
});

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`alpha-research api listening on http://localhost:${info.port}`);
});
