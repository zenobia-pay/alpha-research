# History Dataset Briefing

## Overview
- Snapshot generated on 2026-05-02T03:55:12.585584Z with 2,047 aggregated metadata records spanning nine public-history providers.
- Curated to unify descriptive metadata from Library of Congress, National Archives, Smithsonian, Wikidata, Project Gutenberg, Internet Archive, World Historical Gazetteer, and GeoNames into a single research-ready registry.
- Organized under `dataset/processed/history_sources.parquet` for full coverage with accompanying preview, registry, and build-summary artifacts.

## Data Inventory
- `processed/history_sources.parquet`: 2,047 normalized records across all sources (17 standardized columns).
- `processed/history_sources_sample.csv`: 200-row preview extracted from the Parquet table.
- `processed/source_registry.json`: per-source documentation including licensing, API endpoints, and refresh guidance.
- `processed/build_summary.json`: automated counts confirming per-source totals and listing artifact paths.
- `raw/*.json`: source-specific harvest outputs retaining original API response structures for traceability.

## Sources
- `loc_collections` (Library of Congress Digital Collections) — 500 records, public-domain metadata via loc.gov collections API; sampling limited to first five pages.
- `loc_chronicling` (Chronicling America newspapers) — 500 records covering 1915-1917 Omaha issues; licenses treated as public domain.
- `nara_data_inventory` (National Archives) — 84 catalog entries from `data.json`; rights vary by dataset.
- `smithsonian_open_access` — 100 CC0 object records retrieved via Smithsonian API demo key.
- `wikidata_events` — 200 CC0 historical event entities from SPARQL query results (temporal strings in ISO format with `Z`).
- `project_gutenberg` — 160 Gutendex records (five pages) spanning text and audio classifications.
- `internet_archive_gutenberg` — 150 Internet Archive items tagged to the Gutenberg collection; licensing varies per item.
- `world_historical_gazetteer` — 101 CC BY-NC dataset summaries.
- `geonames_country_info` — 252 CC BY country descriptors parsed from `countryInfo.txt`.

## Schemas
- Single normalized schema (`history_sources`) with 17 columns: identifiers (`source_id`, `record_id`), descriptive text (`title`, `description`, `subjects`), geographic and temporal coverage fields, source metadata (`source_url`, `api_endpoint`, `license`, `record_type`, `language`, `modified`, `retrieved_at`), categorical harmonization (`source_name`, `source_category`), and extensibility via `extra_notes` JSON strings for source-specific attributes.
- `source_category` values observed: newspaper_issue, collection_catalog, gazetteer_reference, knowledge_graph_event, public_domain_text, digital_library_item, gazetteer_dataset, museum_object, agency_dataset.

## Time Coverage
- 500 newspaper issue records provide machine-parsable dates from 1915-07-03 through 1917-05-26 (UTC interpreted).
- Wikidata events include ISO timestamps ranging from 1698-01-01 to 2018-11-11, but remain strings pending downstream normalization.
- Smithsonian items supply free-text dates (e.g., "11 Jun 1967"), requiring per-source parsing; other sources lack temporal values.

## Geography Coverage
- GeoNames contributes ISO alpha-2 country codes for 252 nations and territories, delivering complete spatial coverage for that domain.
- Library of Congress collections list pipe-delimited place hierarchies (e.g., "nebraska | omaha | united states"), while other sources omit spatial fields.
- Overall, 1,162 records carry non-null `spatial_coverage` values; further geocoding is required for hierarchical strings.

## Formats
- Primary analytics format: Parquet (Arrow 24.0.0) for columnar interoperability.
- Supplementary inspection formats: CSV preview (UTF-8) and JSON documents for registry metadata and raw harvests.
- All source harvests preserved as newline-free JSON arrays under `dataset/raw/` for reproducibility.

## Transformations & Derived Fields
- Raw API responses flattened and mapped into the 17-field schema, with controlled vocabularies assigned to `source_category` and `record_type`.
- `extra_notes` captures residual structured attributes (e.g., GeoNames population, Smithsonian object identifiers) as JSON-encoded strings.
- Deduplicated column ordering and typed casting executed during Parquet build; CSV preview generated from the Parquet table.
- Build pipeline recorded in `scripts/build_history_registry.py` (referenced in manifest) for reruns with updated credentials and rate-limit handling.

## Quality & Validation
- `processed/build_summary.json` aligns per-source record counts with manifest declarations, confirming ingestion totals.
- No additional field-level validation or schema enforcement beyond column presence; temporal formats remain heterogeneous.
- Duplicate `record_id` values detected (809 instances), concentrated in Library of Congress collections/issues where identical URLs appear multiple times.

## Limitations & Known Gaps
- Dataset reflects partial harvests (e.g., capped API pages, 200-event limit) and should not be treated as exhaustive for any source.
- Temporal coverage is inconsistent across providers and often unparsed; downstream normalization is required for longitudinal analyses.
- Spatial coverage outside GeoNames and selected LOC records is sparse, limiting geographic analytics without enrichment.
- Licensing statements mirror source text and may require manual confirmation before redistribution, especially for Internet Archive holdings.
- `extra_notes` values are stored as strings containing JSON and demand additional parsing to recover nested details.


## Local Documentation Sync
- This file is the canonical docs-side copy of the dataset briefing. The daily improvement automation must rewrite this file and `docs/public-datasets/history.mdx` whenever it changes the mounted `dataset_briefing.md`.
