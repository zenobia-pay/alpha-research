# Canonical Dataset Self-Improvement: {datasetName} (`{datasetId}`)

You are running a self-improvement pass for one canonical public Alpha Research dataset.

Field brief:

```text
{fieldBrief}
```

## First, Ground In Disk Truth

Before searching or changing anything, read these files from the mounted dataset volume when present:

- `volume_inventory.jsonl`
- `volume_inventory.csv`
- `volume_inventory_summary.json`
- `volume_tree.txt`
- `download_inventory.jsonl`
- `download_inventory.csv`
- `raw_inventory.jsonl`
- `raw_inventory.csv`
- `dataset_briefing.md`
- `quality_report.md`
- `source_registry.csv`
- `source_registry.plan.json`

If `volume_inventory.*` is missing or stale, regenerate it before doing external research.

## Dataset Contract

- Public data only. Do not use private user data.
- This canonical dataset is a raw public source package.
- Do not publish processed tables, merged panels, shared entity models, cross-source joins, derived fields, or analysis-ready outputs as canonical dataset artifacts.
- Keep provider-native files/API responses, codebooks, schemas, documentation, and raw source artifacts in source-specific paths.
- Every attempted download must be logged in `download_inventory.*`.
- Every raw source artifact on disk must be logged in `raw_inventory.*`.
- Every file on the dataset volume must be logged in `volume_inventory.*`.
- `dataset_briefing.md` must be regenerated from the inventories, not from memory or narrative assumptions.

## Candidate Classification

Use Exa and public web/API searches to find newly relevant public sources for `{datasetName}`. Classify each candidate as exactly one of:

- `active_fetchable`
- `deferred_fetchable`
- `license_review`
- `credential_required`
- `not_found`
- `reject`

If a source is public and machine-fetchable but license-unclear, download it only with `license_status: needs_review` and explicit caveats in all inventories, result files, and the briefing.

Do not bypass paywalls, login walls, robots restrictions, anti-bot systems, institutional access controls, or private credential requirements.

## Required Outputs

Write or update these files at the dataset root:

- `improvement_plan.md`
- `improvement_result.json`
- `candidate_sources.csv`
- `exa_search_log.json`
- `download_inventory.jsonl`
- `download_inventory.csv`
- `raw_inventory.jsonl`
- `raw_inventory.csv`
- `volume_inventory.jsonl`
- `volume_inventory.csv`
- `volume_inventory_summary.json`
- `volume_tree.txt`
- `manifest.json`
- `source_registry.csv`
- `source_registry.plan.json`
- `data_dictionary.md`
- `quality_report.md`
- `dataset_briefing.md`
- `docs/public-datasets/briefings/{datasetId}.md`
- `docs/public-datasets/{datasetId}.mdx`

`improvement_result.json` must include:

```json
{
  "datasetId": "{datasetId}",
  "datasetName": "{datasetName}",
  "status": "completed|blocked",
  "checkedAt": "ISO-8601 timestamp",
  "diskInventoryProven": true,
  "volumeInventoryUpdatedAt": "ISO-8601 timestamp",
  "currentCoverageSummary": {},
  "downloadedSources": [],
  "downloadedLicenseReviewSources": [],
  "downloadAttempts": [],
  "promoteNow": [],
  "defer": [],
  "needsHumanReview": [],
  "rejected": [],
  "notFound": [],
  "nextRunHints": []
}
```

## Final Response

Return a concise summary with run status, new sources downloaded, deferred/rejected sources, files written, docs updated, and whether `diskInventoryProven` is true.
