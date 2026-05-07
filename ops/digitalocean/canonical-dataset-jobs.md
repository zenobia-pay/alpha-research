# Canonical Dataset Jobs

Canonical public datasets are refreshed by the ingest worker. The scheduler should be owned by the backend or by a systemd timer on `alpha-research-ingest`; the CLI should only start ad hoc builds and analyses.

Canonical jobs should use the `canonical-public` resource profile unless the source registry has a measured reason to request a larger profile. Do not resize every canonical dataset workspace to 500GiB.

## Jobs

Each canonical dataset has two daily jobs:

- `canonical-refresh`: fetch active public raw sources, preserve provider-native source shapes, validate, and publish dataset artifacts.
- `canonical-expand`: reason over field coverage and propose source-registry changes.
- `canonical-improve`: run a remote Codex pass that treats `dataset_briefing.md` as the dataset-owned source of truth, searches the internet with Exa, downloads newly found public/fetchable raw source data, downloads public `license_review` sources while marking them as needing review, updates inventories and exact native-shape documentation, removes or deprecates canonical processed/derived outputs, rewrites the briefing, mirrors the same briefing into docs, and sends one Slack webhook briefing summarizing what the job searched, found, downloaded, failed to download, ignored, and updated.

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
- `download_inventory.jsonl`
- `download_inventory.csv`
- `download_events.jsonl`
- `slack_download_alerts.jsonl`
- `slack_briefing.md`
- `raw_inventory.jsonl`
- `raw_inventory.csv`
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
- `slack_briefing.md`
- `download_events.jsonl`
- `slack_download_alerts.jsonl`
- `raw_inventory.jsonl`
- `raw_inventory.csv`
- `dataset_briefing.md`

The remote runner must have an authenticated Codex CLI/session and `CANONICAL_DATASET_SLACK_WEBHOOK_URL` in its environment for create, refresh, and improvement jobs. Improvement jobs may also use `EXA_API_KEY`. These are worker secrets; prompts and artifacts must never include secret values. If the Slack webhook is unavailable, jobs must still write `slack_briefing.md`, append pending/failed alert rows to `slack_download_alerts.jsonl`, and record pending webhook payloads in the structured result instead of silently dropping notifications.

Every download attempt must be logged twice on the mounted dataset root:

- one terminal attempt row in `download_inventory.jsonl` / `.csv`;
- lifecycle event rows in `download_events.jsonl`.

Every terminal download attempt must have one corresponding `slack_download_alerts.jsonl` row with `delivery_status: sent|pending|failed`. The alert row and Slack payload must be self-contained: source name/id, terminal status, subject/entities, geography, time coverage, units/measures, schema, row or object count when known, access/license status, blockers, and explicit not-present caveats when a filename could mislead.

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
