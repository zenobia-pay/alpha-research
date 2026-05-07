# Classics Dataset Briefing

## Overview
- Dataset id: `classics`.
- Canonical storage policy: raw public source data only. Do not publish canonical analysis tables, merged panels, shared entity models, or cross-source computed outputs.
- Scope: Greek and Latin texts, classical authors and works, editions, inscriptions, papyri, ancient places, prosopography, and public classical corpora.
- The CLI-visible briefing is `dataset.briefing.markdown`, backed by dataset-root `dataset_briefing.md`.
- Last docs contract update: 2026-05-07T04:53:58.913Z.

## Raw Data Inventory
| Source family | Raw artifact shape | What the briefing must describe |
| --- | --- | --- |
| Open Greek and Latin / First1KGreek / Perseus | TEI XML, MODS/MADS XML, catalog files, repository metadata | Text and catalog source files retained in repository/source formats. |
| PHI/Digital Latin Library references, inscriptions, papyri, EDR/EDB/EAGLE/Papyri.info | Public downloads/API records or gated references | Text, inscription, papyrus, and edition source records. |
| Pleiades, Pelagios, Nomisma, Trismegistos, Wikidata, VIAF | CSV/GeoJSON/SPARQL/API responses | Places, persons, works, authorities, and gazetteer records in source-native schemas. |
| Museum collection data | Public collection APIs/downloads | Material culture records by provider. |

## Source Shape Requirements
- Keep each provider's files/API responses in source-specific raw paths.
- Record exact file/API shape for every raw artifact: path, format, byte count, hash, row/document/object count when measurable, native fields, native keys, time/geography/topic coverage, license/access status, retrieval timestamp, and request URL with secrets redacted.
- Keep provider codebooks, README files, schemas, and data dictionaries beside the raw artifacts when public.
- Do not rewrite fields into a shared schema as part of the canonical package. If an analysis needs a derived table, create it as a separate run artifact outside the canonical raw dataset.

## Deprecated Canonical Artifacts
These may exist in older mounted versions, but they should be removed from the next published canonical raw version or moved to non-canonical analysis artifacts:
- Perseus/PHI crosswalk as canonical data
- Pleiades-derived joins as canonical outputs
- single place/person/work harmonization tables

## Required Briefing Sections
- Raw source inventory with exact source paths and source URLs.
- Native file/API schemas and field descriptions, not shared cross-source schemas.
- Native time, geography, topic, language, collection, or corpus coverage by source.
- Provenance: retrieval method, timestamp, request URL, hash, license/access notes, and gating reason.
- Quality: fetch success/failure, completeness notes, malformed files, source caveats, and redistribution limits.
- Gaps and next refresh hints.

## Current Gaps And Repair Notes
- Current package has valuable raw TEI/XML/CSV/GeoJSON assets but docs should distinguish them from derived crosswalks.
- Wikidata snapshots with invalid JSON/control characters need source-level QA notes or exclusion until fixed.

## Documentation Sync
- The dataset refresh/improvement job must write this same content to dataset-root `dataset_briefing.md`, expose it as `dataset.briefing.markdown` in `GET /api/cli/datasets/classics`, and mirror it into `docs/public-datasets/briefings/classics.md` and `docs/public-datasets/classics.mdx`.
