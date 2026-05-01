# Canonical Dataset Jobs

Canonical public datasets are refreshed by the ingest worker. The scheduler should be owned by the backend or by a systemd timer on `alpha-research-ingest`; the CLI should only start ad hoc builds and analyses.

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
