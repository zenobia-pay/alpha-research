# History Dataset Briefing

## Overview
- Dataset id: `history`.
- Canonical storage policy: raw public source data only. Do not publish canonical analysis tables, merged panels, shared entity models, or cross-source computed outputs.
- Scope: Archives, primary-source documents, newspapers, public records, places, people, organizations, event chronologies, and historical time series.
- The CLI-visible briefing is `dataset.briefing.markdown`, backed by dataset-root `dataset_briefing.md`.
- Last docs contract update: 2026-05-07T04:53:58.913Z.

## Raw Data Inventory
| Source family | Raw artifact shape | What the briefing must describe |
| --- | --- | --- |
| Library of Congress, Chronicling America, National Archives, DPLA, Smithsonian | API JSON/search result snapshots and documentation | Collections, newspaper issues/pages, catalog records, archival objects, and public metadata. |
| HathiTrust, Internet Archive, Project Gutenberg, Wikisource | Catalog/API/text metadata and public-domain content pointers | Text corpora and bibliographic records in source-native structures. |
| Europeana, Wikidata, World Historical Gazetteer, GeoNames, OpenHistoricalMap | API/SPARQL/download responses | Places, events, people, and gazetteer records in provider schemas. |
| IPUMS NHGIS, Census historical data, Our World in Data, Clio Infra | Public downloads or gated references with license notes | Historical demographic and indicator data retained by source. |

## Source Shape Requirements
- Keep each provider's files/API responses in source-specific raw paths.
- Record exact file/API shape for every raw artifact: path, format, byte count, hash, row/document/object count when measurable, native fields, native keys, time/geography/topic coverage, license/access status, retrieval timestamp, and request URL with secrets redacted.
- Keep provider codebooks, README files, schemas, and data dictionaries beside the raw artifacts when public.
- Do not rewrite fields into a shared schema as part of the canonical package. If an analysis needs a derived table, create it as a separate run artifact outside the canonical raw dataset.

## Deprecated Canonical Artifacts
These may exist in older mounted versions, but they should be removed from the next published canonical raw version or moved to non-canonical analysis artifacts:
- processed/history_sources.parquet
- single flattened 17-column history_sources table
- processed CSV previews as canonical outputs

## Required Briefing Sections
- Raw source inventory with exact source paths and source URLs.
- Native file/API schemas and field descriptions, not shared cross-source schemas.
- Native time, geography, topic, language, collection, or corpus coverage by source.
- Provenance: retrieval method, timestamp, request URL, hash, license/access notes, and gating reason.
- Quality: fetch success/failure, completeness notes, malformed files, source caveats, and redistribution limits.
- Gaps and next refresh hints.

## Current Gaps And Repair Notes
- Existing processed history table should be replaced by raw source snapshots plus per-source shape notes.
- Temporal fields should remain source-native with parsing caveats in the briefing.

## Documentation Sync
- The dataset refresh/improvement job must write this same content to dataset-root `dataset_briefing.md`, expose it as `dataset.briefing.markdown` in `GET /api/cli/datasets/history`, and mirror it into `docs/public-datasets/briefings/history.md` and `docs/public-datasets/history.mdx`.
