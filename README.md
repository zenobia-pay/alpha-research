# Alpha Research

`alpha-research` is a dataset-centric platform for building deployable research products over arbitrary data, not just text corpora.

## Installation

COPY THIS PROMPT AND DESCRIBE YOUR DATASET AT THE BOTTOM:

```text
Install the RESEARCH CLI, sign in, create a research dataset from my file, and deploy it.

Run:
curl -fsSL https://raw.githubusercontent.com/zenobia-pay/alpha-research/codex/initial-substrate/scripts/install_alpha_research.sh | bash

Then run:
research

Once the RESEARCH agent opens, tell it to create a dataset from "/ABSOLUTE/PATH/TO/DATASET", choose the right dataset name and id from my description, sign in if needed, and deploy it.

Dataset description:
```

You can also generate a customized version of that prompt:

```bash
npm run build -w @alpha-datasets/cli
npm run cli -- install-prompt --dataset ~/Downloads/Enriched\ Tweets.parquet --mode tabular --id enriched-tweets --name "Enriched Tweets"
```

## Overview

The core ideas are:

- the platform centers on `dataset`, `record`, `facet`, `measure`, and `artifact`
- text retrieval is an optional projection, not the primary ontology
- adapters can expose text-first datasets like tweet archives and structured datasets like census or economic tables through the same query surface

## Repo Shape

- `AGENTS.md`
  - agent-facing map of the repo, common commands, and debug workflow
- `docs/ARCHITECTURE.md`, `docs/RUN_LIFECYCLE.md`, `docs/HARNESS.md`
  - canonical CLI architecture, remote run lifecycle, and harness engineering docs
- `packages/core`
  - dataset model
  - adapter contracts
  - generic query and aggregation helpers
  - optional text-compatibility projection
- `packages/implementations`
  - per-instance branding and product configuration
- `packages/storage`
  - sharded manifest format, lazy loaders, and compatibility support for legacy bundles
- `packages/fixture`
  - a text-heavy tweet-thread fixture
  - a structured county-economics fixture
- `apps/api`
  - local API server for instance bootstrap, query, record lookup, and aggregation
- `apps/ingest`
  - arbitrary dataset normalizer for tabular and unstructured input
- `apps/frontend`
  - product frontend for exploring any active instance
- `apps/cli`
  - Ink-based interactive agent shell plus scripted dataset commands

## Why This Exists

AlphaBook already has a reusable text-corpus substrate, but its runtime remains anchored to document-like shapes. This repo starts from a broader foundation:

- text is one modality among many
- tabular and time-series datasets are first-class
- "document" is only a compatibility view generated from records when a downstream system needs text hydration or citation-style synthesis

## Core Model

The substrate is built around:

- `DatasetDescriptor`
- `DatasetRecord`
- `DatasetField`
- `DatasetMeasure`
- `DatasetArtifact`
- `DatasetQuery`
- `DatasetAggregationRequest`
- `DatasetTextProjection`

Adapters provide records and may optionally provide text projections. Generic helpers then support:

- filtering
- text search over projections
- group-by aggregations over numeric measures
- compatibility conversion into document-like text blobs

## Local Usage

Install dependencies:

```bash
npm install
```

Run the full local stack:

```bash
npm run dev:stack
```

The API runs on `http://localhost:8787` and the frontend on `http://localhost:4173`.

The repo ships with two demo instances:

- `demo-tweets`
- `demo-econ`

You can also use the low-level CLI:

```bash
npm run dev:cli -- fixture describe tweets
```

The main CLI surface is `research`.

Running `research` with no arguments opens the interactive agent UI.

Then use it:

```bash
research login
research
```

Inside the agent UI, you can ask it to:

- sign in
- list local datasets
- create a dataset from a file and deploy it
- list remote datasets
- start remote runs

Non-interactive prompt mode is available for harnesses and scripts:

```bash
research --prompt "show remote datasets"
```

Debug a remote run without relying on screenshots:

```bash
research debug run <run-id>
research debug run <run-id> --output /tmp/research-run-debug.json
```

Normalize a new arbitrary tabular dataset into a deployable research package:

```bash
npm run dev:ingest -- \
  --input ~/Downloads/Enriched\ Tweets.parquet \
  --id enriched-tweets \
  --name "Enriched Tweets" \
  --dataset-id tweets \
  --entity-type tweet \
  --title-field tweet_id \
  --summary-field full_text \
  --text-fields full_text,username,account_display_name \
  --date-field created_at
```

Normalize an unstructured text corpus from a directory or file set:

```bash
npm run ingest:unstructured -- \
  --input ~/Documents/my-corpus \
  --id essays \
  --name "Collected Essays" \
  --dataset-id essays
```

That writes a sharded package under `data/instances/<instance-id>/`:

- `manifest.json`
- `records/.../part-*.jsonl.gz`
- `text-projections/.../part-*.jsonl.gz`

The API and frontend can serve that package immediately.

## Deployment Shape

The local runtime serves sharded dataset packages from `DATASET_INSTANCE_ROOT`, but the intended production architecture is:

- canonical dataset store in object storage
- partitioned Parquet for tabular and time-series source records
- sharded text projections as compressed JSONL for local/runtime hydration
- Postgres for the metadata catalog
- Qdrant on local NVMe for vector retrieval
- optional keyword index in Typesense, Meilisearch, or OpenSearch
- DigitalOcean volumes as the attached normalized-cache layer for ingest and serving droplets

The intended remote ingest flow is:

1. user signs in through `research`
2. CLI sends planning/orchestration requests to Alpha Research backend
3. backend schedules dataset normalization on a droplet with a mounted DigitalOcean volume
4. ingest writes the normalized manifest plus shard set onto that mounted volume
5. serving/orchestrator droplets attach the same volume or hydrate from object storage as needed
6. the volume-backed normalized package is then mirrored or promoted into canonical object storage

The local package format is still the bridge between ingest and production:

1. normalize a source file with `apps/ingest`
2. write a manifest plus shard set under `data/instances/<instance-id>/`
3. treat that format as the same shape the remote ingest job will place onto the attached volume
4. optionally mirror that package into object storage for long-term canonical storage

## Testing

Harness checks for the RESEARCH CLI:

```bash
npm run harness:check
npm run test:cli
npm run test:golden
```

These run offline against fake remote clients and isolated CLI session state.

The shortest test loop is:

1. `npm install`
2. `npm run dev:stack`
3. open `http://localhost:4173`
4. switch between `demo-tweets` and `demo-econ`
5. run a search and an aggregation

You can also test the API directly:

```bash
curl http://localhost:8787/api/instances
curl http://localhost:8787/api/instances/demo-tweets/bootstrap
curl -X POST http://localhost:8787/api/instances/demo-econ/aggregate \
  -H 'content-type: application/json' \
  -d '{"groupBy":"state","measure":"median_household_income","op":"avg"}'
```

## Ingestion Modes

The repo now supports multiple ingestion paths:

- Tabular: CSV, JSON array-of-objects, Parquet
- Unstructured: `.txt`, `.md`, `.markdown`, `.html`, `.htm`, and `.pdf` when `pypdf` is available

Recommended process for a new dataset:

1. Decide whether the primary unit is tabular row, thread, document, or file.
2. Run `research ingest ...` or the matching ingest script to generate a sharded package.
3. Inspect the generated `manifest.json` and shard directories.
4. Start the stack locally and check the dataset in the UI.
5. If the schema needs refinement, rerun ingest with different title/summary/text field choices.

### Current Status

Ingestion is working for:

- tabular normalization into sharded manifest packages
- unstructured text normalization into sharded manifest packages
- lazy local serving of those packages via the API and frontend

The storage model is documented in [docs/storage-architecture.md](docs/storage-architecture.md).

The RESEARCH CLI login flow targets `https://alpharesearch.nyc/cli/login` by default and stores the session locally in `~/.research/session.json`. Once signed in, the CLI should use the Alpha Research backend for planning instead of relying on a local `OPENAI_API_KEY`. See [docs/cli-auth.md](docs/cli-auth.md).

## DigitalOcean Deployment

The recommended production topology is:

- one object storage bucket for canonical dataset packages
- one Postgres instance for dataset catalog and shard metadata
- one Qdrant droplet with local NVMe for vector search
- one API/orchestrator droplet that reads from a local shard cache or synchronized object-store mirror
- one optional ingest/worker droplet for heavier normalization or scheduled refreshes
- one frontend deployment, either:
  - static assets on a small droplet behind Nginx, or
  - object storage/CDN if you want the frontend completely decoupled

The current architecture works especially well when:

- datasets are large enough that monolithic JSON bundles are no longer viable
- ingest runs offline and writes canonical package artifacts into object storage
- API nodes stay stateless apart from a local package cache
- vector retrieval needs Qdrant performance characteristics instead of block storage

See [ops/digitalocean/README.md](ops/digitalocean/README.md) for the concrete layout and service templates.

## Initial Direction

This repo is intentionally narrow in scope for the first commit:

- define the general substrate cleanly
- attach a real API and frontend
- make new dataset instances cheap to spin up locally
- keep persistence simple before introducing heavier infra

The next layer after this scaffold should be:

1. direct object-storage readers and writers beyond local package roots
2. Postgres-backed shard catalogs instead of filesystem discovery alone
3. Qdrant and optional keyword-index integration in the query path
4. runtime execution plans that can mix table operations with text-backed evidence gathering
