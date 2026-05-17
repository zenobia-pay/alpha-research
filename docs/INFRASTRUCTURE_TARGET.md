# Infrastructure Target

Alpha Research canonical public datasets are durable Modal-volume-backed source packages today. Each canonical dataset has a stable Modal volume that stores provider-native raw files, inventories, quality reports, docs mirrors, and `dataset_briefing.md`. The lifecycle should be modeled around that concrete volume plus active writer operations, not around an overloaded `ready` deployment flag.

## Goals

- Host canonical public datasets in stable Modal volumes with explicit mount/write checks.
- Allow maintenance automation to repair stale profile or inventory metadata whenever the volume exists and no writer is active.
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
  +-- Modal volumes
  |     canonical public dataset roots, raw source packages, manifests,
  |     source registries, volume inventories, data dictionaries,
  |     quality reports, dataset briefings, docs mirrors
  |
  +-- Worker pool
  |     Modal runners with small scratch volumes by default
  |
  +-- Retrieval services
        Qdrant/vector indexes and optional keyword indexes, keyed by dataset version
```

## Canonical Modal Volume Contract

Each canonical dataset has one durable Modal volume:

```text
/data/datasets/econ/
  manifest.json
  source_registry.csv
  source_registry.plan.json
  download_inventory.jsonl
  raw_inventory.jsonl
  volume_inventory.jsonl
  volume_inventory_summary.json
  data_dictionary.md
  quality_report.md
  dataset_briefing.md
  docs/public-datasets/briefings/econ.md
  docs/public-datasets/econ.mdx
```

The dataset is "created" when the catalog row and Modal volume identity exist. From there, derived booleans describe usability:

- `volumeAvailable`: the volume exists and can be mounted.
- `writerLocked`: a bootstrap, refresh, improve, audit, or profile-sync operation is active.
- `improvable`: `volumeAvailable && !writerLocked`.
- `queryable`: the backend profile has current `briefingMarkdown`, disk inventory proof, and readback verification.
- `missingOrStale`: repairable gaps such as missing volume inventory proof, stale docs mirrors, missing briefing, or legacy status reconciliation.

Do not gate canonical maintenance on `status === "ready"` and `deploymentStatus === "ready"`. Those legacy fields are compatibility labels; they should be reconciled from Modal-volume facts, not used as the source of truth.

## Concurrency

The dataset lock model should be:

- One writer operation per canonical Modal volume.
- Read-only describe/query flows should use the backend profile and should not hold a writer lock.
- Improvement, refresh, audit, bootstrap, and profile-sync jobs may take the writer lock.
- A completed or cancelled operation must release the writer lock even if legacy readiness labels need later reconciliation.

This separates "can mutate the volume" from "can answer user queries".

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

- Modal volumes for canonical public dataset roots.
- Object storage for run logs and artifacts.
- Managed Postgres for catalog and run/event state.
- Modal runners with profile-specific CPU, memory, and scratch settings.
- Optional Qdrant worker with local NVMe or a managed vector database.
- Stable Modal volumes for canonical public datasets; scratch volumes remain profile-specific worker resources.

Avoid:

- treating `ready` as a universal lifecycle truth,
- storing important run logs only on the worker,
- using stale writer locks as indefinite blockers after an operation is terminal.

## Migration Plan

1. Add explicit Modal volume metadata to dataset records: volume name, mount path, last mount check, and last writable check.
2. Replace write gates based on `status` / `deploymentStatus` with `improvable`.
3. Store active writer operation metadata separately from dataset usability.
4. Reconcile completed operations into profile proof and legacy display labels.
5. Persist worker logs to Postgres/object storage.
6. Add stale-operation detection that can cancel/reconcile locks without changing volume contents.
