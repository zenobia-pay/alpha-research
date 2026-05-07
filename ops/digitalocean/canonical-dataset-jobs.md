# Canonical Dataset Jobs

Canonical public datasets are refreshed by the ingest worker. The scheduler should be owned by the backend or by a systemd timer on `alpha-research-ingest`; the CLI should only start ad hoc builds and analyses.

Canonical jobs should use the `canonical-public` resource profile unless the source registry has a measured reason to request a larger profile. Do not resize every canonical dataset workspace to 500GiB.

## Jobs

Each canonical dataset has two daily jobs:

- `canonical-refresh`: fetch active public sources, preserve source-specific shapes, validate, and publish dataset artifacts.
- `canonical-expand`: reason over field coverage and propose source-registry changes.
- `canonical-improve`: run a remote Codex pass that treats `dataset_briefing.md` as the dataset-owned source of truth, searches the internet with Exa, downloads newly found public/compatible/fetchable data, updates inventories and exact shape documentation, rewrites the briefing, mirrors the same briefing into docs, and sends Slack webhook alerts when a high-value source appears relevant but cannot be found, fetched, licensed, or accessed without credentials.

Recommended cadence:

- `canonical-refresh`: daily at 02:00 UTC.
- `canonical-expand`: daily at 04:00 UTC, after refresh finishes or after the refresh timeout expires.
- `canonical-improve`: daily at 05:00 UTC, after expansion planning. The local cron entry should run `npm run canonical:improve` from this repository; that script starts one remote Codex run per ready canonical dataset and skips datasets with active runs.

The local cron entry for expansion planning should run `npm run canonical:expand` from this repository; that script starts one remote run per ready canonical dataset and skips datasets with active runs.

## Required Inputs

- Dataset id, for example `econ`.
- Dataset name, for example `Econ`.
- Source registry from `docs/CANONICAL_PUBLIC_DATASETS.md`.
- Existing dataset manifest/profile if present.
- Prior `source_registry.plan.json` and `expansion_plan.md` if present.

## Required Outputs

Every successful refresh should publish:

- `manifest.json`
- `source_registry.csv`
- `source_registry.plan.json`
- `data_dictionary.md`
- `quality_report.md`
- `dataset_briefing.md`
- `docs/public-datasets/briefings/<datasetId>.md`
- `docs/public-datasets/<datasetId>.mdx`

Every successful expansion run should publish:

- `expansion_plan.md`
- updated `source_registry.plan.json`
- candidate-source review table with statuses:
  - `active_fetchable`
  - `deferred_fetchable`
  - `license_review`
  - `credential_required`
  - `reject`

Every successful improvement run should publish:

- `improvement_plan.md`
- `improvement_result.json`
- `candidate_sources.csv`
- `exa_search_log.json`

The remote runner must have `EXA_API_KEY` and `CANONICAL_DATASET_SLACK_WEBHOOK_URL` in its environment. These are worker secrets; prompts and artifacts must never include secret values.

## Deployment Notes

The backend should seed canonical dataset rows before the first refresh so public inventory is stable:

- `econ`
- `sociology`
- `philosophy`
- `history`
- `literature`
- `political-science`
- `anthropology`
- `linguistics`
- `classics`

The first production implementation can use a single daily worker loop:

1. Load canonical dataset config.
2. For each dataset, skip if another run is active.
3. Start or continue `canonical-refresh`.
4. Start `canonical-expand` after refresh completes or times out.
5. Persist run ids, statuses, artifact URLs, and latest successful manifest path in the catalog.

Do not allow expansion jobs to ingest sources that require credentials, paid access, unclear licenses, scraping behind anti-bot controls, or user-provided private data. Those candidates should stay in `source_registry.plan.json` until a human promotes them.

## Storage and Concurrency

Daily canonical jobs should publish immutable dataset versions to object storage:

```text
datasets/<datasetId>/versions/<versionId>/
```

Analysis, briefing, and expansion-planning runs should bind to a published dataset version and read it concurrently. Improvement runs need a writer lock when they download new source data or rewrite `dataset_briefing.md` and docs mirrors. Only refresh/publish/improvement jobs that mutate dataset artifacts need a writer lock for a dataset. A failed provisioning or refresh attempt must mark the job/deployment as failed and preserve the error in run events so the dataset does not remain stuck in `deploying`.
