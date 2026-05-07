## Overview
- Canonical registry summarizing 11 widely used political science data sources with standardized metadata on coverage, refresh cadence, formats, access, and provenance.
- Current edition created 2026-05-02 for the Alpha Research political-science dataset mount; refresh guidance documented the same day.

## Data Inventory
- `dataset/source_registry.parquet` — Typed table of 11 records covering all metadata fields described below.
- `dataset/source_registry.csv` — Flat text export matching the Parquet schema for interoperability.
- `dataset/source_registry.json` — JSON list mirroring the registry for lightweight integrations.
- `dataset/refresh_notes.md` — Operational playbook detailing monitoring steps for each source.

## Sources
- `medsl_election_returns` (MIT Election Data and Science Lab): United States precinct-to-state election returns, 1976-2024; latest noted release 2024 precinct returns posted 2024-11-14; refresh after each election cycle; open web access via https://electionlab.mit.edu/data.
- `anes_time_series` (American National Election Studies): U.S. public opinion surveys, 1948-2024; latest full release 2024 Time Series issued 2025-08-08; refresh each presidential cycle; public-use downloads with restricted supplements via ANES Data Center.
- `ces_common_content` (Harvard IQSS): U.S. Cooperative Election Study common content, 2006-2024; cumulative v10 release; annual updates; open Dataverse downloads.
- `cses_modules` (CSES Secretariat): Cross-national electoral modules, 1996-2026; Module 6 Second Advance Release dated 2025-12-16; modular releases roughly every five years; open access through GESIS.
- `manifesto_project` (WZB & University of Göttingen): Party manifesto indicators, 1945-2025 across 67 countries; dataset version 2025a; at least annual releases; registration-required public download.
- `vdem_global` (V-Dem Institute): Global democracy indicators, 1789-2025; v16 (2026 Democracy Report) release; annual cadence; open downloads with accompanying documentation.
- `qog_standard` (QoG Institute): Governance indicator compilation, 1946-2025; Jan26 edition; annual January release; open public-use access.
- `polity5` (Center for Systemic Peace): Regime characteristics time series, 1800-2018; latest published 2020-04-23; irregular updates; open download from INSCR page.
- `worldbank_wgi` (World Bank): Worldwide Governance Indicators, 1996-2024 with 2025 methodology revision; annual updates; open Databank, CSV, and Excel access.
- `idea_voter_turnout` (International IDEA): Global voter turnout statistics, 1945-2025; continuously updated post-election; open interactive database and downloadable tables.
- `world_values_survey` (World Values Survey Association): Wave 8 global values surveys, 1981-2026 cumulative with 2024-2026 fieldwork; multi-year waves; account-required public download.

## Schemas
- Registry table columns: `dataset_id`, `name`, `provider`, `summary`, `geographic_scope`, `temporal_coverage`, `update_frequency`, `data_types`, `primary_topics`, `latest_release`, `data_formats`, `access_level`, `license_notes`, `access_url`, `documentation_url`, `refresh_strategy`, `retrieval_date`, `source_citations`.
- Array fields (`data_types`, `primary_topics`, `data_formats`, `source_citations`) preserve multi-valued attributes rather than concatenated strings.
- `retrieval_date` recorded as ISO date string reflecting the most recent manual verification event (2026-05-02 for all entries).

## Time Coverage
- Aggregate span inferred from temporal coverage strings runs from 1789 (V-Dem historical coverage) through 2026 (anticipated end of Wave 8 and CSES Module 6 cycle).
- U.S.-focused sources cover 1948-2024 (ANES) and 1976-2024 (MEDSL, CES), while global comparative datasets extend across 1945-2025 (Manifesto, IDEA) and 1800-2018 (Polity5).
- Temporal ranges are stored as free-text; normalization may be required before automated filtering.

## Geography Coverage
- Mixture of United States-exclusive sources (MEDSL, ANES, CES) and global datasets covering 59–200+ polities, including 67-country manifesto coverage and worldwide indicator programs (V-Dem, QoG, WGI, IDEA, WVS).
- Geographic scope captured verbatim from providers to preserve source language (e.g., "Global (planned 80 countries)").

## Formats
- Registry distributed as Parquet, CSV, and JSON; operational refresh guidance stored as Markdown.
- Source-level format arrays enumerate downstream availability across CSV, Stata, SPSS, R, Excel, ZIP bundles, APIs, interactive portals, and documentation PDFs.

## Transformations & Derived Fields
- Individual source records harmonized into a common schema with consistent identifier, provider, and coverage fields across all file formats.
- List-valued fields retained as arrays to ensure lossless export between JSON, CSV (stringified lists), and Parquet (native arrays).
- Refresh strategies consolidated from provider notes into standardized guidance per source in both the registry and refresh notes.

## Quality & Validation
- Entire registry and refresh guidance manually reviewed on 2026-05-02; `retrieval_date` reflects this verification pass.
- Record counts aligned across JSON, CSV, and Parquet outputs (11 records each) to ensure parity.
- Schema typed in Parquet to enforce string vs. list distinctions and support downstream validation.

## Limitations & Known Gaps
- Metadata relies on manual tracking of provider announcements; release dates may lag rapidly changing sources.
- Temporal coverage values are descriptive strings rather than parsed ranges, limiting direct chronological queries without preprocessing.
- Registry does not include the underlying datasets; users must follow access URLs and comply with provider-specific terms.


## Local Documentation Sync
- This file is the canonical docs-side copy of the dataset briefing. The daily improvement automation must rewrite this file and `docs/public-datasets/political-science.mdx` whenever it changes the mounted `dataset_briefing.md`.
