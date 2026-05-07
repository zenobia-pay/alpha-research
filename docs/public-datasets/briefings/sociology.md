# Sociology Dataset Briefing

## Overview
- Dataset id: `sociology`.
- Canonical storage policy: raw public source data only. Do not publish canonical analysis tables, merged panels, shared entity models, or cross-source computed outputs.
- Scope: Social structure, inequality, demographics, institutions, family, work, religion, politics, mobility, health, crime, and social attitudes.
- The CLI-visible briefing is `dataset.briefing.markdown`, backed by dataset-root `dataset_briefing.md`.
- Last docs contract update: 2026-05-07T04:53:58.913Z.

## Raw Data Inventory
| Source family | Raw artifact shape | What the briefing must describe |
| --- | --- | --- |
| GSS, ANES, WVS, ESS, Pew, ICPSR/OpenICPSR | Provider files, codebooks, metadata, and public API/download records | Survey instruments, respondent data, and codebooks only where redistribution is allowed. |
| ACS, CPS, IPUMS pointers, PSID, NLS, Add Health | Public metadata/download manifests; credentialed extracts stay as gated references | Population, household, education, work, family, and mobility source data. |
| OECD, World Bank, CDC, BJS, FBI Crime Data Explorer, UN/WHO/UNESCO/ILO | API responses, CSV/JSON downloads, and source documentation | Public indicators preserved in source-native schemas. |
| Current registry files | registry/sources.csv, registry/sources.json, registry/schema.json | Metadata-only source catalog; no raw survey payloads are currently packaged. |

## Source Shape Requirements
- Keep each provider's files/API responses in source-specific raw paths.
- Record exact file/API shape for every raw artifact: path, format, byte count, hash, row/document/object count when measurable, native fields, native keys, time/geography/topic coverage, license/access status, retrieval timestamp, and request URL with secrets redacted.
- Keep provider codebooks, README files, schemas, and data dictionaries beside the raw artifacts when public.
- Do not rewrite fields into a shared schema as part of the canonical package. If an analysis needs a derived table, create it as a separate run artifact outside the canonical raw dataset.

## Deprecated Canonical Artifacts
These may exist in older mounted versions, but they should be removed from the next published canonical raw version or moved to non-canonical analysis artifacts:
- Any future cross-survey respondent mega-table
- Cross-survey attitude/demographic tables unless created as separate analysis artifacts

## Required Briefing Sections
- Raw source inventory with exact source paths and source URLs.
- Native file/API schemas and field descriptions, not shared cross-source schemas.
- Native time, geography, topic, language, collection, or corpus coverage by source.
- Provenance: retrieval method, timestamp, request URL, hash, license/access notes, and gating reason.
- Quality: fetch success/failure, completeness notes, malformed files, source caveats, and redistribution limits.
- Gaps and next refresh hints.

## Current Gaps And Repair Notes
- Current package is mostly a source registry; next refresh should add raw public files/codebooks for open sources.
- Credentialed sources must remain registry entries with gating reasons.

## Documentation Sync
- The dataset refresh/improvement job must write this same content to dataset-root `dataset_briefing.md`, expose it as `dataset.briefing.markdown` in `GET /api/cli/datasets/sociology`, and mirror it into `docs/public-datasets/briefings/sociology.md` and `docs/public-datasets/sociology.mdx`.
