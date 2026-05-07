# Anthropology Dataset Briefing

## Overview
- Dataset id: `anthropology`.
- Canonical storage policy: raw public source data only. Do not publish canonical analysis tables, merged panels, shared entity models, or cross-source computed outputs.
- Scope: Cultures, languages, archaeology, ethnography metadata, places, cultural traits, material culture, comparative datasets, and open repository records.
- The CLI-visible briefing is `dataset.briefing.markdown`, backed by dataset-root `dataset_briefing.md`.
- Last docs contract update: 2026-05-07T04:53:58.913Z.

## Raw Data Inventory
| Source family | Raw artifact shape | What the briefing must describe |
| --- | --- | --- |
| D-PLACE, HRAF/eHRAF references, Open Context, tDAR, ARIADNEplus | Public downloads/API records or gated references | Cultural traits, archaeological records, and ethnographic metadata by provider. |
| Glottolog, WALS, CLDF/CLLD, Ethnologue public metadata | CLDF/source downloads and public metadata | Language and typology source files retained in native structures. |
| Smithsonian, GBIF, museum/archive repositories, Zenodo communities | Collection APIs, CSV/JSON exports, repository metadata | Material culture, specimen, place, and repository records. |
| Current registry files | source-registry.json and related metadata | Source catalog only unless raw provider files are present. |

## Source Shape Requirements
- Keep each provider's files/API responses in source-specific raw paths.
- Record exact file/API shape for every raw artifact: path, format, byte count, hash, row/document/object count when measurable, native fields, native keys, time/geography/topic coverage, license/access status, retrieval timestamp, and request URL with secrets redacted.
- Keep provider codebooks, README files, schemas, and data dictionaries beside the raw artifacts when public.
- Do not rewrite fields into a shared schema as part of the canonical package. If an analysis needs a derived table, create it as a separate run artifact outside the canonical raw dataset.

## Deprecated Canonical Artifacts
These may exist in older mounted versions, but they should be removed from the next published canonical raw version or moved to non-canonical analysis artifacts:
- Any cross-source cultures/traits mega-table as canonical output
- Metadata-only source registry as a substitute for raw data

## Required Briefing Sections
- Raw source inventory with exact source paths and source URLs.
- Native file/API schemas and field descriptions, not shared cross-source schemas.
- Native time, geography, topic, language, collection, or corpus coverage by source.
- Provenance: retrieval method, timestamp, request URL, hash, license/access notes, and gating reason.
- Quality: fetch success/failure, completeness notes, malformed files, source caveats, and redistribution limits.
- Gaps and next refresh hints.

## Current Gaps And Repair Notes
- Current package is mostly a registry; next refresh should fetch raw public Open Context/CLDF/museum files.
- Paid or credentialed ethnographic sources must stay as gated registry entries.

## Documentation Sync
- The dataset refresh/improvement job must write this same content to dataset-root `dataset_briefing.md`, expose it as `dataset.briefing.markdown` in `GET /api/cli/datasets/anthropology`, and mirror it into `docs/public-datasets/briefings/anthropology.md` and `docs/public-datasets/anthropology.mdx`.
