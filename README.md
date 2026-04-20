# Alpha Datasets

`alpha-datasets` is a dataset-centric substrate for building research products over arbitrary data, not just text corpora.

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
- `packages/fixture`
  - a text-heavy tweet-thread fixture
  - a structured county-economics fixture
- `apps/cli`
  - local runner for describing datasets, previewing records, running filters, and testing text projections

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

Describe the tweet fixture:

```bash
npm run dev -- describe tweets
```

Preview a text query:

```bash
npm run dev -- query tweets --text "housing permits"
```

Run a structured aggregation:

```bash
npm run dev -- aggregate county-economics --group-by state --measure median_household_income
```

## Initial Direction

This repo is intentionally narrow in scope for the first commit:

- define the general substrate cleanly
- prove it with one text-style and one structured dataset
- keep local workflows simple before adding storage, indexing, or deployments

The next layer after this scaffold should be:

1. pluggable storage backends
2. incremental ingest pipelines
3. hybrid retrieval across structured filters and text projections
4. runtime execution plans that can mix table operations with text-backed evidence gathering

