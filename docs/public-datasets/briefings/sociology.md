# Sociology Dataset Briefing

## Overview
- Dataset id: `sociology`.
- Current remote status at 2026-05-04T22:43:13.348Z: dataset `deploying`, deployment `provisioning`.
- Curated registry of ten flagship sociology-related survey and indicator programs covering U.S. and global social statistics, with metadata on provenance, access, formats, and refresh cadence.
- Remote manifest path: `/mnt/alpha-research/datasets/sociology/manifest.json`.
- This dataset is not a single universal normalized table. It is a collection of source-specific files, registries, tables, and document collections described below.

## Exact Data Currently Present
- Source summary: - sources where counted; status breakdown -.
- Current table/file inventory:

| Path | Rows | Columns | Grain | Time Coverage | Geography |
| --- | ---: | --- | --- | --- | --- |
| `registry/sources.csv` | - | dataset_id, title, provider, description, geographic_scope, temporal_coverage, latest_release, update_cadence, population_focus, key_topics, data_formats, access_level, primary_url, download_links, license, citation, notes, refresh_strategy, next_refresh_check, source_citations | - | - | - |
| `registry/sources.json` | - | dataset_id, title, provider, description, geographic_scope, temporal_coverage, latest_release, update_cadence, population_focus, key_topics, data_formats, access_level, primary_url, download_links, license, citation, notes, refresh_strategy, next_refresh_check, source_citations | - | - | - |
| `registry/schema.json` | - | - | - | - | - |

## Schemas And Fields
- `registry/sources`: `dataset_id` (string: Stable identifier for the dataset entry.); `title` (string: Official dataset title.); `provider` (string: Institution responsible for the dataset.); `description` (string: Brief summary of dataset scope and content.); `geographic_scope` (string: Primary geographic coverage.); `temporal_coverage` (object: Start and end year for the current release.); `latest_release` (date: ISO date for the most recent release (approximate if day unknown).); `update_cadence` (string: Typical update or fielding frequency.); `population_focus` (string: Population or universe represented.); `key_topics` (array: Primary subject domains.); `data_formats` (array: Commonly available file formats.); `access_level` (string: Access conditions (public, registration, etc.).); `primary_url` (string: Landing page for dataset or program.); `download_links` (array: Direct download or API endpoints.); `license` (string: License or use terms.); `citation` (string: Recommended citation.); `notes` (string: Additional usage notes.); `refresh_strategy` (string: Recommended monitoring strategy for updates.); `next_refresh_check` (date: Planned date to review for updates.); `source_citations` (array: Identifiers of web sources supporting metadata.)

## Additional Assets
- No additional assets were listed in the saved profile.

## Time Coverage
- {"overall":{"startYear":1940,"endYear":2026},"bySource":{"gss_2024_r2":{"start_year":2024,"end_year":2024},"anes_2024_time_series":{"start_year":2024,"end_year":2024},"census_acs_2020_2024_5yr":{"start_year":2020,"end_year":2024},"census_household_pulse_htops":{"start_year":2020,"end_year":2024},"icpsr_openicpsr_catalog":{"start_year":1940,"end_year":2026},"wvs_wave8_2024_2026":{"start_year":2024,"end_year":2026},"oecd_society_at_a_glance_2024":{"start_year":2024,"end_year":2024},"fed_shed_2024":{"start_year":2024,"end_year":2024},"un_sdg_global_database_2024":{"start_year":2000,"end_year":2024},"mit_spae_2024":{"start_year":2024,"end_year":2024}}}

## Geography Coverage
- Global to OECD members and partner economies to United States to United States; national to tract level

## Formats
- API
- ASCII
- CSV
- JSON
- PDF
- R
- SAS
- SDMX
- SPSS
- Stata
- XLS

## Transformations And Derived Fields
- notes: Metadata-only registry; no in-repo transformations of source data.

## Quality And Validation
- curation: Entries appear manually curated with citations to authoritative web sources.
- validation: No automated validation artifacts present; schema.json defines expected fields.

## Limitations And Known Gaps
- Manifest file is empty and does not summarize dataset state.
- No raw survey or indicator data stored locally; registry references external sources only.
- Refresh notes file is empty, so update procedures are undocumented beyond per-source strategies.

## Local Documentation Sync
- This file is the canonical docs-side copy of the dataset briefing. The daily improvement automation must rewrite this file and `docs/public-datasets/sociology.mdx` whenever it changes the mounted `dataset_briefing.md`.
