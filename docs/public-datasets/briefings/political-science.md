# Political Science Dataset Briefing

## Overview
- Dataset id: `political-science`.
- Canonical storage policy: raw public source data only. Do not publish canonical analysis tables, merged panels, shared entity models, or cross-source computed outputs.
- Scope: Elections, parties, legislatures, governance, institutions, public opinion, comparative politics, conflict, democracy, and policy datasets.
- The CLI-visible briefing is `dataset.briefing.markdown`, backed by dataset-root `dataset_briefing.md`.
- Last docs contract update: 2026-05-07T04:53:58.913Z.

## Raw Data Inventory
| Source family | Raw artifact shape | What the briefing must describe |
| --- | --- | --- |
| ANES, CSES, MIT Election Data and Science Lab, International IDEA | Provider downloads, codebooks, and source metadata | Election and survey files in provider layouts. |
| Voteview, Congress.gov, GovInfo, FEC, OpenSecrets | Bulk files/API responses | Legislator, vote, bill, campaign finance, and lobbying records in source form. |
| Manifesto Project, V-Dem, Polity, QoG, World Bank Governance Indicators | Public downloads or gated/license-review entries | Party, institution, democracy, and governance source data. |
| UCDP, Correlates of War, ICEWS/GDELT | Event/country-year downloads where public | Conflict and event source files retained without cross-source merging. |

## Source Shape Requirements
- Keep each provider's files/API responses in source-specific raw paths.
- Record exact file/API shape for every raw artifact: path, format, byte count, hash, row/document/object count when measurable, native fields, native keys, time/geography/topic coverage, license/access status, retrieval timestamp, and request URL with secrets redacted.
- Keep provider codebooks, README files, schemas, and data dictionaries beside the raw artifacts when public.
- Do not rewrite fields into a shared schema as part of the canonical package. If an analysis needs a derived table, create it as a separate run artifact outside the canonical raw dataset.

## Deprecated Canonical Artifacts
These may exist in older mounted versions, but they should be removed from the next published canonical raw version or moved to non-canonical analysis artifacts:
- source_registry.parquet as a typed canonical table if it substitutes for raw provider files
- country-year mega-table plans as canonical outputs

## Required Briefing Sections
- Raw source inventory with exact source paths and source URLs.
- Native file/API schemas and field descriptions, not shared cross-source schemas.
- Native time, geography, topic, language, collection, or corpus coverage by source.
- Provenance: retrieval method, timestamp, request URL, hash, license/access notes, and gating reason.
- Quality: fetch success/failure, completeness notes, malformed files, source caveats, and redistribution limits.
- Gaps and next refresh hints.

## Current Gaps And Repair Notes
- Current package is registry-heavy; next refresh should add raw public provider files for open sources.
- Licensed/gated sources must remain explicit references with gating reasons.

## Documentation Sync
- The dataset refresh/improvement job must write this same content to dataset-root `dataset_briefing.md`, expose it as `dataset.briefing.markdown` in `GET /api/cli/datasets/political-science`, and mirror it into `docs/public-datasets/briefings/political-science.md` and `docs/public-datasets/political-science.mdx`.
