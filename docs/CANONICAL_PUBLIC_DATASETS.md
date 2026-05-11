# Canonical Public Datasets

This plan defines the evergreen public Alpha Research economics dataset. The canonical dataset is a durable research environment, not a one-off analysis run.

## Product Contract

- The canonical public dataset uses the short, stable id `econ`.
- They are public by default. Private uploads can join a research run, but should not mutate the canonical public dataset.
- Each dataset has a source registry, raw source files/API responses, data dictionary, quality report, raw inventory, and dataset briefing.
- Each dataset has a download inventory and raw inventory that explain exactly what was fetched, when, from where, and what native shape the raw source data has.
- Each dataset refreshes daily. Refresh jobs should update existing source snapshots, append new versions where history matters, and preserve source provenance.
- Each dataset also gets a daily expansion-planning run. This run reasons about missing coverage, new public sources, broken links, licensing constraints, and high-value additions for the field.
- Expansion-planning runs may propose new sources, but only sources that pass licensing, access, and reproducibility checks should become active fetch targets.

## Daily Job Shape

For the canonical `econ` dataset, schedule these jobs:

1. `refresh`
   - Fetch from active public sources.
   - Preserve provider-native files/API responses in source-specific raw paths.
   - Validate source URLs, byte counts, hashes, native record counts, source coverage, license/access status, and fetch quality.
   - Publish `manifest.json`, `source_registry.csv`, `source_registry.plan.json`, `download_inventory.jsonl`, `download_inventory.csv`, `raw_inventory.jsonl`, `raw_inventory.csv`, `data_dictionary.md`, and `quality_report.md`.

## Provenance Inventory Contract

Every canonical refresh must make provenance inspectable without reading agent transcripts. A final row count without source provenance and native shape details is not sufficient.

`download_inventory.jsonl` and `download_inventory.csv` must include one record per attempted source download:

- Source id, source name, and plain-English description.
- Durable canonical/landing URL plus exact request URL or API endpoint used, with secrets redacted.
- Retrieval timestamp, retrieval method, HTTP status, raw output path, raw format, raw byte count, and SHA-256 hash.
- License or terms summary, access status, and failure/gating reason for deferred, credentialed, failed, or skipped sources.

`raw_inventory.jsonl` and `raw_inventory.csv` must include one record per raw source file/API response/document collection:

- Raw id/path, native format, byte count, row/document/object count when measurable, native field count, and content hash.
- Plain-English description of what each native row/object/document represents.
- Source id, canonical URL, request URL, retrieval timestamp, license/access status, and gating reason when relevant.
- Native primary keys or identifiers, native temporal coverage, native geography/topic coverage, and native schema/field descriptions.
- QA checks: fetch status, malformed files, missing source documentation, source caveats, redistribution limits, and known gaps.

`manifest.json`, `data_dictionary.md`, `quality_report.md`, and `dataset_briefing.md` must summarize these inventories. They must not define canonical analysis-ready tables.

2. `expand`
   - Read the dataset profile, prior expansion plans, and failed/deferred sources.
   - Search for newly relevant public datasets, archives, APIs, and corpus releases.
   - Classify each candidate as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, or `reject`.
   - Produce `expansion_plan.md` and update `source_registry.plan.json`.
   - Do not ingest newly discovered sources automatically unless they are clearly public, stable, machine-fetchable, and compatible with the dataset license.

3. `improve`
   - Start one remote Codex run for `econ` using `npm run canonical:improve`.
   - Inspect the mounted dataset, manifest, source registry, data dictionary, quality report, briefing, and previous improvement artifacts.
   - Search the internet with Exa using the remote `EXA_API_KEY`.
   - Classify newly discovered candidate sources as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, `not_found`, or `reject`.
   - Download public, stable, machine-fetchable `license_review` sources instead of blocking on review; mark them as `license_status: needs_review` in inventories and the result.
   - Every create, refresh, and improvement job must run with an authenticated Codex CLI/session and `CANONICAL_DATASET_SLACK_WEBHOOK_URL` in the remote runner environment. The webhook URL is a secret and must never be printed, logged, stored, or included in artifacts.
   - Append every download lifecycle event to dataset-root `download_events.jsonl`, and keep `download_inventory.jsonl` / `.csv` as the source of truth for attempted downloads.
   - Send or queue one Slack webhook alert for every terminal download attempt. Each alert must summarize what the data actually is, including subject/entities, geography, time coverage, units/measures, schema, row or object count when known, access/license status, blockers, and explicit not-present caveats when a filename could mislead. Log each delivery attempt in dataset-root `slack_download_alerts.jsonl` and summarize them in `slack_briefing.md`. Missing or failed Slack delivery must create pending/failed alert rows instead of silently disappearing.
   - Produce `improvement_plan.md`, `improvement_result.json`, `candidate_sources.csv`, `exa_search_log.json`, `download_events.jsonl`, `slack_download_alerts.jsonl`, and `slack_briefing.md`.

## Canonical Dataset Catalog

### Econ (`econ`)

Purpose: macroeconomics, labor, housing, inflation, credit, consumer behavior, regional economics, and business-cycle research.

Initial active/deferred source registry:

- Federal Reserve / FRED: https://fred.stlouisfed.org/
- U.S. Census Bureau: https://www.census.gov/data.html
- American Community Survey: https://www.census.gov/programs-surveys/acs/data.html
- Current Population Survey: https://www.census.gov/programs-surveys/cps.html
- American Housing Survey: https://www.census.gov/programs-surveys/ahs.html
- BLS data portal: https://www.bls.gov/data/
- Consumer Price Index: https://www.bls.gov/cpi/
- American Time Use Survey: https://www.bls.gov/tus/
- Consumer Expenditure Survey: https://www.bls.gov/cex/
- BEA data portal: https://www.bea.gov/data
- Personal Consumption Expenditures: https://www.bea.gov/data/consumer-spending/main
- FHFA Home Price Index: https://www.fhfa.gov/data/hpi
- Zillow research data: https://www.zillow.com/research/data/
- Zillow Home Value Index: https://www.zillow.com/research/data/
- Redfin Data Center: https://www.redfin.com/news/data-center/
- National Association of Realtors research and statistics: https://www.nar.realtor/research-and-statistics
- Case-Shiller Index: https://www.spglobal.com/spdji/en/index-family/corelogic-sp-case-shiller/
- CoreLogic home price insights: https://www.corelogic.com/intelligence/us-home-price-insights/
- Freddie Mac AIMI: https://mf.freddiemac.com/aimi
- Fannie Mae surveys: https://www.fanniemae.com/research-and-insights/surveys
- Federal Reserve Senior Loan Officer Opinion Survey: https://www.federalreserve.gov/data/sloos.htm
- Federal Reserve Bank of New York data: https://www.newyorkfed.org/data-and-statistics
- NBER: https://www.nber.org/
- IMF data: https://www.imf.org/en/Data
- ONS: https://www.ons.gov.uk/
- Pew Research Center: https://www.pewresearch.org/
- General Social Survey: https://gss.norc.org/
- Panel Study of Income Dynamics: https://psidonline.isr.umich.edu/
- Apartment List rent estimates: https://www.apartmentlist.com/research/category/data-rent-estimates

Priority raw source families:

- Preserve provider-native raw files, API responses, codebooks, schemas, and public documentation for the source families above.
- Do not define canonical analysis tables for this dataset; computed tables belong to separate run artifacts.
- Keep exact raw shape, provenance, license/access status, coverage, hashes, and source caveats in `raw_inventory.*` and `dataset_briefing.md`.


## Implementation Plan

1. Create or reuse the public environment for the canonical `econ` dataset.
2. Persist `econ` as backend seed data so `list_remote_datasets` shows it before the first refresh completes.
3. Add scheduler config for `econ` refresh, expand, and improve jobs.
4. Run `refresh` jobs on the ingest worker and `expand` jobs as remote agent runs against the mounted dataset.
5. Add dashboard affordances for public/private, refresh status, last successful manifest, next scheduled refresh, and latest expansion plan.
6. Gate expansion-plan promotions through source status: active public sources can be ingested automatically; credentialed, paid, unclear-license, or brittle sources require human review.
7. Add product tests that assert `econ` exists, is public, has a source registry, and produces refresh/expansion artifacts.

## Initial CLI Prompts

Use these prompts with `create_public_data_environment` or the signed-in `research --prompt` flow.

### Econ

Create or extend the public canonical dataset `econ` named `Econ`. Build a durable economics research environment from the source registry in `docs/CANONICAL_PUBLIC_DATASETS.md`. Fetch representative active public raw sources first, preserve source URLs and native file/API shapes, write `source_registry.csv`, `source_registry.plan.json`, `manifest.json`, `raw_inventory.jsonl`, `raw_inventory.csv`, `data_dictionary.md`, `quality_report.md`, and a dataset briefing. Mark sources that need credentials, unclear licensing, or expensive access as deferred rather than failing the build.
