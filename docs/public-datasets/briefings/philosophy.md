# Philosophy Dataset Briefing

## Overview
- Dataset id: `philosophy`.
- Canonical storage policy: raw public source data only. Do not publish canonical analysis tables, merged panels, shared entity models, or cross-source computed outputs.
- Scope: Canonical texts, contemporary papers, concepts, argument structures, author networks, bibliographic metadata, and teaching/research corpora.
- The CLI-visible briefing is `dataset.briefing.markdown`, backed by dataset-root `dataset_briefing.md`.
- Last docs contract update: 2026-05-07T04:53:58.913Z.

## Raw Data Inventory
| Source family | Raw artifact shape | What the briefing must describe |
| --- | --- | --- |
| SEP and IEP | HTML/metadata snapshots and source URLs | Encyclopedia entries, table-of-contents metadata, authors, and entry structures in source form. |
| PhilPapers/PhilArchive/Open Syllabus | Public metadata where license-compatible; gated metadata remains referenced only | Bibliographic/category/syllabus signals in native exported shape. |
| Project Gutenberg, Internet Archive, HathiTrust public metadata | Catalog/API records and public-domain text pointers | Public-domain philosophy works and metadata without forced entity merging. |
| OpenAlex, Crossref, CORE, Semantic Scholar, Wikidata, DBpedia | API/SPARQL/JSON responses | Works, authors, concepts, citations, and knowledge graph records in provider schemas. |

## Source Shape Requirements
- Keep each provider's files/API responses in source-specific raw paths.
- Record exact file/API shape for every raw artifact: path, format, byte count, hash, row/document/object count when measurable, native fields, native keys, time/geography/topic coverage, license/access status, retrieval timestamp, and request URL with secrets redacted.
- Keep provider codebooks, README files, schemas, and data dictionaries beside the raw artifacts when public.
- Do not rewrite fields into a shared schema as part of the canonical package. If an analysis needs a derived table, create it as a separate run artifact outside the canonical raw dataset.

## Deprecated Canonical Artifacts
These may exist in older mounted versions, but they should be removed from the next published canonical raw version or moved to non-canonical analysis artifacts:
- Unified works/authors/concepts tables as canonical outputs
- Cross-source identifier tables as canonical data

## Required Briefing Sections
- Raw source inventory with exact source paths and source URLs.
- Native file/API schemas and field descriptions, not shared cross-source schemas.
- Native time, geography, topic, language, collection, or corpus coverage by source.
- Provenance: retrieval method, timestamp, request URL, hash, license/access notes, and gating reason.
- Quality: fetch success/failure, completeness notes, malformed files, source caveats, and redistribution limits.
- Gaps and next refresh hints.

## Current Gaps And Repair Notes
- Current package contains source-shaped metadata snapshots but has no authoritative source-wide raw inventory file yet.
- Full text availability and licensing must be documented source by source.

## Documentation Sync
- The dataset refresh/improvement job must write this same content to dataset-root `dataset_briefing.md`, expose it as `dataset.briefing.markdown` in `GET /api/cli/datasets/philosophy`, and mirror it into `docs/public-datasets/briefings/philosophy.md` and `docs/public-datasets/philosophy.mdx`.
