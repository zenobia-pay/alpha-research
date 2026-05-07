# Canonical Dataset Expansion Planning: {datasetName} (`{datasetId}`)

You are running the daily *canonical dataset expansion-planning* job for the public Alpha Research dataset `{datasetId}`.

This job proposes new public sources and updates the source registry plan. It must not ingest new sources automatically.

The canonical dataset is a raw public source package. The plan should preserve provider-native files/API responses, source-specific document collections, native schemas, keys, formats, and provenance. Do not propose processed tables, merged panels, shared entity models, cross-source joins, derived fields, or analysis-ready tables as canonical dataset outputs.

## Operating contract (must follow)
- Public data only. Do not include private user data.
- Do not propose sources that require credentials, paid access, unclear licensing, or brittle/anti-bot scraping to fetch.
- If a source is valuable but gated, classify it as `credential_required` or `license_review` (do not promote it).
- Prefer stable government, academic, and open-repository sources with durable landing pages and machine-friendly APIs/downloads.
- Preserve provenance: keep canonical landing URLs, direct download/API endpoints, license notes, and gating reasons.

## Inputs to inspect (when available)
Inspect the mounted dataset root and any published artifacts, including:
- `source_registry.plan.json` (if present)
- `source_registry.csv` (if present)
- `manifest.json`
- `data_dictionary.md`
- `quality_report.md`
- `dataset_briefing.md`
- Any prior `expansion_plan.md`

Treat `dataset_briefing.md` as the primary exact inventory for what the CLI can tell users about this dataset. If it is missing or vague, mark that as a coverage gap and specify the briefing sections the next refresh/improvement run must fill.

If `source_registry.plan.json` is missing, reconstruct it from `source_registry.csv` or `manifest.json` (preserving prior deferred/gated items where possible) before writing outputs.

## Required outputs (write these exact files at the dataset root and ensure they are attached as artifacts)
- `expansion_plan.md`
- `source_registry.plan.json` (updated; must preserve existing entries and statuses, adding/adjusting candidates)

## Required classification statuses
Every candidate source must be classified as one of:
- `active_fetchable`
- `deferred_fetchable`
- `license_review`
- `credential_required`
- `reject`

## `source_registry.plan.json` shape
Write `source_registry.plan.json` as a JSON object with a top-level `sources` array. Each source entry must include at least:
- `source_name`
- `required_url` (starting URL from the field catalog or prior plan, if any)
- `canonical_url` (best landing page)
- `direct_download_url` (if file-based; otherwise null)
- `api_endpoint` (if API-based; otherwise null)
- `fetchability` (one of the statuses above)
- `relevance` (short string)
- `expected_raw_artifacts` (array of raw source file/API artifact ids)
- `geography` (string; "global" allowed)
- `frequency` (string; "static"/"daily"/"monthly"/"annual"/etc)
- `license` (string; include URL when available)
- `gating_reason` (string; empty if none)
- `notes` (string)

Preserve any existing keys/fields already present in the mounted dataset's plan; do not delete unknown fields.

## Expansion plan requirements (`expansion_plan.md`)
`expansion_plan.md` must include:
1) Coverage gaps (what's missing in the current dataset)
2) Candidate source review table with columns:
   - `source_name`, `canonical_url`, `direct_download_url/api_endpoint`, `license`, `status`, `why_it_matters`, `expected_raw_artifacts`, `gating_reason`, `notes`
3) Promotions: list sources moved to `active_fetchable` with rationale
4) Deferrals: list sources kept as `deferred_fetchable` (public but lower priority / heavier ETL)
5) Blockers: list `license_review` and `credential_required` items with the concrete missing condition
6) Briefing update requirements: exact additions that `dataset_briefing.md` and `docs/public-datasets/{datasetId}.mdx` must receive if each candidate is later ingested

## Field brief
{fieldBrief}

## Field catalog sources (starting point)
{fieldCatalogSources}

## Seed candidates to evaluate (verify access/licensing; reclassify if needed)
{seedCandidates}

## Final response requirements
- Confirm the exact paths written for `expansion_plan.md` and `source_registry.plan.json`.
- Attach both files as artifacts.
