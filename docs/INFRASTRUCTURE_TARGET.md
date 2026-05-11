# Infrastructure Target

Alpha Research should treat datasets as immutable, versioned research artifacts, not as mutable mounted volumes. Mounted volumes are useful for worker scratch and hot caches, but they should not be the canonical dataset store or the concurrency boundary for user analysis.

## Goals

- Host large public and private datasets without preallocating large block volumes for every dataset.
- Allow many concurrent read/analysis runs against the same dataset.
- Keep refresh and ingest jobs reproducible, versioned, and rollbackable.
- Persist run logs, terminal output, events, and artifacts independently of worker lifetime.
- Scale compute by workload class instead of using one oversized default.

## Target Shape

```text
Alpha API / dashboard
  |
  +-- Managed Postgres
  |     datasets, dataset_versions, source_registry, runs, run_events,
  |     job queue state, artifact metadata, version pointers
  |
  +-- Object storage
  |     raw snapshots, normalized Parquet/JSONL shards, manifests,
  |     source registries, data dictionaries, quality reports,
  |     run logs, run artifacts
  |
  +-- Worker pool
  |     Modal runners with small scratch volumes by default
  |
  +-- Retrieval services
        Qdrant/vector indexes and optional keyword indexes, keyed by dataset version
```

## Dataset Versioning

Each dataset has immutable versions:

```text
datasets/econ/versions/2026-05-02T020000Z/
  manifest.json
  source_registry.csv
  source_registry.plan.json
  tables/
  docs/
  indexes/
```

Runs bind to a specific dataset version. Refresh jobs write a new version and atomically advance the `latest` pointer after validation passes. Existing analysis runs continue against the version they started with.

## Concurrency

The dataset lock model should be:

- Many concurrent read/analysis/briefing runs per dataset version.
- One refresh or publish job per dataset target version.
- One index publish per dataset/version/index type.
- No analysis run should hold a canonical dataset volume lock.

This replaces the current one-run-per-dataset-volume bottleneck.

## Persistent Logs

Run logs must outlive workers:

- Structured timeline: `run_events` in Postgres.
- Raw stdout/stderr/terminal replay: object storage under `runs/{runId}/logs/`.
- Artifacts: object storage under `runs/{runId}/artifacts/`, with metadata rows in Postgres.

Workers should stream events and logs while running. If a worker dies, the dashboard should still show the durable partial log trail.

## Resource Profiles

Use named profiles instead of one hard-coded workspace size:

| Profile | Modal CPU / Memory | Scratch | Use |
| --- | --- | ---: | --- |
| `briefing` | 2 CPU / 4GiB | 20GiB | dataset documentation, profile reads |
| `canonical-public` | 4 CPU / 8GiB | 50GiB | public source discovery, small refreshes, expansion planning |
| `standard-analysis` | 8 CPU / 16GiB | 100GiB | normal analysis and transformation runs |
| `large-ingest` | 8 CPU / 16GiB | 500GiB | explicit large backfills after size estimation |

Large storage should be opt-in. Canonical public datasets should start small and publish durable objects to object storage.

## Modal Mapping

Recommended backend resources:

- Object storage for canonical dataset versions and run artifacts.
- Managed Postgres for catalog and run/event state.
- Modal runners with profile-specific CPU, memory, and scratch settings.
- Optional Qdrant worker with local NVMe or a managed vector database.
- Block volumes only for scratch, hot cache, and stateful retrieval services.

Avoid:

- one permanent 500GiB volume per dataset,
- resizing every public-data environment to 500GiB,
- storing important run logs only on the worker,
- using dataset volume attachment as the analysis concurrency control.

## Migration Plan

1. Lower default scratch sizes and use resource profiles.
2. Make provisioning failures terminal and visible on dataset deployment records.
3. Persist worker logs to Postgres/object storage.
4. Add `dataset_versions` and bind runs to versions.
5. Publish manifests and shards to object storage.
6. Allow concurrent read runs against published dataset versions.
7. Limit writer locks to refresh/publish operations.
8. Clean up stale detached volumes and failed provisioning artifacts.
