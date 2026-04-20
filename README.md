# Alpha Research

`alpha-research` is a dataset-centric platform for building deployable research products over arbitrary data, not just text corpora.

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
  - arbitrary dataset normalizer for tabular and unstructured input
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
npm run dev:cli -- fixture describe tweets
```

The real CLI surface is `research`.

## Copy This To Your Agent

```text
Install the RESEARCH CLI and ingest my dataset.

Run:
curl -fsSL https://raw.githubusercontent.com/zenobia-pay/alpha-research/codex/initial-substrate/scripts/install_alpha_research.sh | bash

Then run:
research ingest --mode tabular --input "/ABSOLUTE/PATH/TO/DATASET" --id my-dataset --name "My Dataset" --dataset-id my-dataset

After ingest finishes, tell me which instance bundle was created and how to launch the local stack.
```

You can also generate a customized version of that prompt:

```bash
npm run build -w @alpha-datasets/cli
npm run cli -- install-prompt --dataset ~/Downloads/Enriched\ Tweets.parquet --mode tabular --id enriched-tweets --name "Enriched Tweets"
```

Then use it:

```bash
research instances
research login
research ingest --mode tabular --input ~/Downloads/Enriched\ Tweets.parquet --id enriched-tweets --name "Enriched Tweets" --dataset-id tweets --entity-type tweet --title-field tweet_id --summary-field full_text --text-fields full_text,username,account_display_name --date-field created_at
```

Normalize a new arbitrary tabular dataset into a deployable instance bundle:

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

That writes `data/instances/<instance-id>/instance.json`, which the API and frontend can serve immediately.

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

## Testing

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
2. Run `research ingest ...` or the matching ingest script to generate an instance bundle.
3. Inspect the generated `instance.json`.
4. Start the stack locally and check the dataset in the UI.
5. If the schema needs refinement, rerun ingest with different title/summary/text field choices.

### Current Status

Ingestion is working for:

- tabular normalization into instance bundles
- unstructured text normalization into instance bundles
- serving those bundles locally via the API and frontend

What is **not** fully complete yet is the account-backed CLI login on the website. The CLI side is implemented, but the web app still needs the matching `/cli/login` endpoint. See [docs/cli-auth.md](docs/cli-auth.md).

## DigitalOcean Deployment

The recommended production topology is:

- one mounted DigitalOcean Volume for `data/instances`
- one API/orchestrator droplet that reads bundles from that mounted volume
- one optional ingest/worker droplet for heavier normalization or scheduled refreshes
- one frontend deployment, either:
  - static assets on a small droplet behind Nginx, or
  - object storage/CDN if you want the frontend completely decoupled

The current architecture works especially well when:

- datasets are large enough that you want persistent attached storage
- instance bundles are generated offline or by workers
- API nodes should stay stateless apart from the mounted dataset volume

See [ops/digitalocean/README.md](ops/digitalocean/README.md) for the concrete layout and service templates.

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
