# Alpha Datasets

`alpha-datasets` is a dataset-centric platform for building deployable research products over arbitrary data, not just text corpora.

The core idea is:

- the platform centers on `dataset`, `record`, `facet`, `measure`, and `artifact`
- text retrieval is an optional projection, not the primary ontology
- adapters can expose text-first datasets like tweet archives and structured datasets like census or economic tables through the same query surface

## Repo Shape

- `packages/core`
  - dataset model
  - adapter contracts
  - generic query and aggregation helpers
  - optional text-compatibility projection
- `packages/implementations`
  - per-instance branding and product configuration
- `packages/storage`
  - file-backed instance bundle format and loaders
- `packages/fixture`
  - a text-heavy tweet-thread fixture
  - a structured county-economics fixture
- `apps/api`
  - local API server for instance bootstrap, query, record lookup, and aggregation
- `apps/ingest`
  - arbitrary dataset normalizer for CSV, JSON, and Parquet input
- `apps/frontend`
  - product frontend for exploring any active instance
- `apps/cli`
  - local runner for low-level inspection and compatibility checks

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
npm run dev:cli -- describe tweets
```

Normalize a new arbitrary dataset into a deployable instance bundle:

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

That writes `data/instances/enriched-tweets/instance.json`, which the API and frontend can serve immediately.

## Deployment Shape

This first deployment-ready version is intentionally file-backed:

- ingest turns source files into portable instance bundles
- the API serves bundles directly from `data/instances/*/instance.json`
- the frontend discovers instances through the API
- each dataset instance carries its own branding and product metadata

That means spinning up a new dataset is cheap:

1. normalize a source file with `apps/ingest`
2. put the generated bundle under `data/instances/<instance-id>/instance.json`
3. start or deploy the API and frontend
4. select the instance in the UI

## Initial Direction

This repo is intentionally narrow in scope for the first commit:

- define the general substrate cleanly
- attach a real API and frontend
- make new dataset instances cheap to spin up locally
- keep persistence simple before introducing heavier infra

The next layer after this scaffold should be:

1. pluggable storage backends beyond flat-file bundles
2. richer ingest controls for schema overrides and field typing
3. hybrid retrieval across structured filters and text projections
4. runtime execution plans that can mix table operations with text-backed evidence gathering
