# Linguistics Dataset Briefing

## Overview
- Dataset id: `linguistics`.
- Canonical storage policy: raw public source data only. Do not publish canonical analysis tables, merged panels, shared entity models, or cross-source computed outputs.
- Scope: Languages, typology, phonology, lexicons, syntax, corpora, CLDF datasets, treebanks, language metadata, and documentation archives.
- The CLI-visible briefing is `dataset.briefing.markdown`, backed by dataset-root `dataset_briefing.md`.
- Last docs contract update: 2026-05-07T04:53:58.913Z.

## Raw Data Inventory
| Source family | Raw artifact shape | What the briefing must describe |
| --- | --- | --- |
| Glottolog, WALS, PHOIBLE, Lexibank, CLDF packages | Versioned ZIP/CLDF source packages and metadata | Language, typology, phonology, and lexicon records in upstream package schemas. |
| Universal Dependencies, OPUS, Tatoeba, Open Multilingual Wordnet | Repository releases/downloads and release metadata | Treebanks, parallel corpora, sentence pairs, and lexical data in native formats. |
| CHILDES/TalkBank, Common Voice, OLAC, ELAR, PARADISEC, Leipzig Corpora | Public metadata/download pointers; gated media remains referenced only | Speech, documentation, archive, and corpus records retained by source. |
| Current raw archives | dataset/raw/* where present | Upstream raw archives should be the canonical package; derived CSVs are non-canonical. |

## Source Shape Requirements
- Keep each provider's files/API responses in source-specific raw paths.
- Record exact file/API shape for every raw artifact: path, format, byte count, hash, row/document/object count when measurable, native fields, native keys, time/geography/topic coverage, license/access status, retrieval timestamp, and request URL with secrets redacted.
- Keep provider codebooks, README files, schemas, and data dictionaries beside the raw artifacts when public.
- Do not rewrite fields into a shared schema as part of the canonical package. If an analysis needs a derived table, create it as a separate run artifact outside the canonical raw dataset.

## Deprecated Canonical Artifacts
These may exist in older mounted versions, but they should be removed from the next published canonical raw version or moved to non-canonical analysis artifacts:
- canonical_language_index.csv as canonical data
- phoible_inventory_stats.csv as canonical data
- universal_dependencies_releases.csv as canonical data
- canonical_schemas/mappings as a shared-schema contract

## Required Briefing Sections
- Raw source inventory with exact source paths and source URLs.
- Native file/API schemas and field descriptions, not shared cross-source schemas.
- Native time, geography, topic, language, collection, or corpus coverage by source.
- Provenance: retrieval method, timestamp, request URL, hash, license/access notes, and gating reason.
- Quality: fetch success/failure, completeness notes, malformed files, source caveats, and redistribution limits.
- Gaps and next refresh hints.

## Current Gaps And Repair Notes
- Next refresh should publish raw upstream packages plus checksums and stop treating derived CSV indexes as canonical.
- Redistribution-restricted ISO 639-3 assets must remain references only.

## Documentation Sync
- The dataset refresh/improvement job must write this same content to dataset-root `dataset_briefing.md`, expose it as `dataset.briefing.markdown` in `GET /api/cli/datasets/linguistics`, and mirror it into `docs/public-datasets/briefings/linguistics.md` and `docs/public-datasets/linguistics.mdx`.
