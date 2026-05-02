# Canonical Dataset Jobs

Canonical public datasets are refreshed by the ingest worker. The scheduler should be owned by the backend or by a systemd timer on `alpha-research-ingest`; the CLI should only start ad hoc builds and analyses.

Canonical jobs should use the `canonical-public` resource profile unless the source registry has a measured reason to request a larger profile. Do not resize every canonical dataset workspace to 500GiB.

## Jobs

Each canonical dataset has two daily jobs:

- `canonical-refresh`: fetch active public sources, normalize, validate, and publish dataset artifacts.
- `canonical-expand`: reason over field coverage and propose source-registry changes.

Recommended cadence:

- `canonical-refresh`: daily at 02:00 UTC.
- `canonical-expand`: daily at 04:00 UTC, after refresh finishes or after the refresh timeout expires.

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

Every successful expansion run should publish:

- `expansion_plan.md`
- updated `source_registry.plan.json`
- candidate-source review table with statuses:
  - `active_fetchable`
  - `deferred_fetchable`
  - `license_review`
  - `credential_required`
  - `reject`

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

Analysis, briefing, and expansion-planning runs should bind to a published dataset version and read it concurrently. Only refresh/publish jobs need a writer lock for a dataset. A failed provisioning or refresh attempt must mark the job/deployment as failed and preserve the error in run events so the dataset does not remain stuck in `deploying`.
