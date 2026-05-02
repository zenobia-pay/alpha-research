# Storage Architecture

`alpha-research` now uses a sharded package format locally and targets object-storage-first deployment for large datasets.

## Goals

- avoid monolithic `instance.json` bundles
- keep local development simple
- make the production shape compatible with multi-terabyte datasets
- separate canonical storage, metadata catalog, and retrieval indexes

## Canonical Production Model

- canonical store: object storage
- metadata catalog: Postgres
- vector search: Qdrant on local NVMe
- optional keyword search: Typesense, Meilisearch, or OpenSearch
- tabular/time-series source data: partitioned Parquet
- text projections: sharded JSONL, ideally zstd-compressed in production
- normalized working set: ephemeral worker scratch plus optional mounted DigitalOcean cache volumes

## Remote Ingest Direction

For large datasets, normalization should happen remotely on infrastructure that can read and write the canonical object store. Mounted volumes are scratch/cache, not the source of truth.

Recommended flow:

1. the CLI authenticates to Alpha Research
2. the backend plans ingest with the platform OpenAI key, not the user's local machine
3. source data is uploaded or otherwise made reachable to a remote ingest worker
4. the ingest worker writes raw snapshots, normalized shards, manifests, and artifacts to object storage
5. Postgres records the dataset version, source registry, shard inventory, quality reports, and latest-version pointer
6. serving and runner droplets hydrate only the needed partitions into local scratch/cache

This avoids making the user's laptop or any single mounted volume the source of truth for deployment. It also allows multiple read-only analysis runs to use the same dataset version concurrently while a refresh builds the next version.

## Local Package Format

Each dataset instance under `data/instances/<instance-id>/` contains:

- `manifest.json`
- `records/.../part-*.jsonl.gz`
- `text-projections/.../part-*.jsonl.gz`

The manifest carries:

- implementation metadata
- descriptor/schema metadata
- storage profile
- counts and sample rows
- shard inventory with relative paths, row counts, compression, and partitions

## Why Not One Giant JSON File

Large datasets fail under a single-bundle design because:

- JSON repeats keys and inflates storage
- the loader usually has to materialize the whole file in memory
- multi-million-row datasets can exceed Node file-size and heap limits
- refreshes require rewriting the entire dataset artifact

Shards fix this by allowing:

- lazy scans
- partial rewrites
- partition-aware placement
- cacheable object-store artifacts

## Current Runtime Behavior

Today the local API reads the manifest and scans shard files lazily from `DATASET_INSTANCE_ROOT`.

That means:

- old `instance.json` demo bundles still work
- new ingests write shard packages by default
- query and aggregation no longer require loading an entire dataset into memory first

## Production Direction

The intended next production steps are:

1. write the canonical package into object storage instead of only a local directory
2. persist manifest and shard metadata into Postgres
3. register text/vector projections in Qdrant and an optional keyword index
4. let API nodes hydrate a local shard cache on demand instead of relying on a shared volume
5. version every published dataset and bind runs to immutable dataset versions
6. persist run logs and artifacts to Postgres/object storage while workers execute
