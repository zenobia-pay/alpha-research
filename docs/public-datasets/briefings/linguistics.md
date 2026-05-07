# Linguistics Dataset Briefing

## Overview
- Integrated registry aligning Glottolog 5.3, WALS 2020.4, PHOIBLE 2.0, and Universal Dependencies 2.17 into a shared language index with 8,618 language-level records.
- Crosswalk fields connect Glottocodes to ISO 639-3 codes (7,859 matches), WALS identifiers (2,423 matches), and PHOIBLE inventory sizes (2,034 matches) for comparative analysis.
- Source registry catalogs eleven upstream datasets, documenting publishers, versions, licenses, and refresh cadences as of 2 May 2026.

## Data Inventory
- `dataset/data/canonical_language_index.csv`: 8,618 rows; Glottocode-keyed language registry with geographic, genealogical, ISO, WALS, and PHOIBLE crosswalk attributes.
- `dataset/data/phoible_inventory_stats.csv`: 2,186 rows; PHOIBLE-derived phonological inventory sizes per Glottocode (11–622 segments, mean 48.24).
- `dataset/data/universal_dependencies_releases.csv`: 23 rows; Universal Dependencies release history with treebank and language counts (versions 2.17 through 1.0).
- `dataset/source-registry.json`: Metadata for eleven upstream resources (Glottolog, WALS, PHOIBLE, UD, ISO 639-3, Wikidata, CLDF Spec, Lexibank, Grambank, Common Voice, MLCommons speech).
- `dataset/schema/canonical_schemas.json` and `dataset/schema/mappings/*.json`: Canonical schema definitions and field-level transformation notes underpinning the derived tables.

## Sources
- Glottolog 5.3 (released 2 Mar 2026, CC BY 4.0) provides authoritative language identifiers, macroareas, coordinates, and genealogies.
- WALS 2020.4 (released 18 Oct 2024, CC BY 4.0) contributes typological metadata and language crosswalks.
- PHOIBLE 2.0 (released 14 Mar 2019, CC BY-SA 3.0) supplies phonological inventory counts aggregated per language.
- Universal Dependencies 2.17 (released 15 Nov 2025, CC BY-SA 4.0 default) informs the treebank release timeline.
- Supplemental registry entries document ISO 639-3 (15 Oct 2025), Wikidata language dump (1 Jan 2024), Lexibank 2.1 (11 Apr 2025), Grambank 1.0 (4 Apr 2023), CLDF spec 1.3.1 (29 Jan 2024), Mozilla Common Voice 24.0 (17 Dec 2025), and MLCommons Unsupervised People’s Speech 2025-01 (23 Jan 2025).

## Schemas
- Canonical schemas define five tables (`languages`, `phonological_inventories`, `typological_features`, `ud_treebanks`, `dataset_registry`) with explicit field types, primary keys, and descriptions.
- Mapping files specify column-level provenance from source CLDF packages (Glottolog, WALS) and derived aggregations (PHOIBLE inventories, UD release metadata), ensuring reproducible transformations.
- `typological_features` schema exists but does not yet have a materialized dataset in `dataset/data/`.

## Time Coverage
- Language registry reflects Glottolog 5.3 content current to 2 Mar 2026; auxiliary sources span 2019–2026 per registry metadata.
- Universal Dependencies release log captures versions from 1.0 (15 Jan 2015) through 2.17 (15 Nov 2025), providing a decade-long timeline of treebank growth.

## Geography Coverage
- Macroarea values cover eleven Glottolog-defined regions (Africa, Eurasia, Papunesia, Americas, Australia), indicating global scope.
- Country codes include 244 ISO 3166-1 alpha-2 entries; highest representation in Papua New Guinea (899 languages), Indonesia (756), Nigeria (589), India (518), and China (452).

## Formats
- Tabular assets stored as UTF-8 CSV files with header rows; record separators use commas and semicolon-delimited multi-value cells for countries, WALS codes, and sources.
- Metadata artifacts supplied as JSON (`source-registry.json`, schema definitions, mapping notes) for machine-readable integration.
- Upstream raw archives retained under `dataset/raw/` as versioned ZIP directories for reproducibility.

## Transformations & Derived Fields
- Glottolog CLDF `languages.csv` filtered to `Level == "language"`, with country lists and macroareas carried forward; genealogical parent (`family_glottocode`) preserved for hierarchy analyses.
- WALS language IDs aggregated per Glottocode into semicolon-separated lists, enabling many-to-one joins.
- PHOIBLE inventory sizes computed by counting rows per `Language_ID` in `values.csv`; results joined back to the canonical registry to populate `phoible_inventory_size`.
- Universal Dependencies release metadata transcribed from the official download history, capturing versioned counts and persistent handle URLs.

## Quality & Validation
- Canonical schemas provide documented field expectations but there is no automated validation run captured in this workspace; consistency relies on manual checks during rebuilds.
- Refresh notes prescribe a rebuild checklist (update raw archives, regenerate CSVs, verify schema alignment, update source registry) to maintain data integrity across releases.
- Manual entry of UD release statistics introduces potential transcription error; no checksum or API verification is recorded.

## Limitations & Known Gaps
- `dataset/data/phoible_inventory_stats.csv` omits the `dataset_version` column described in the canonical schema, limiting multi-source comparisons.
- `typological_features` table is defined but not yet produced, leaving WALS feature values outside the current packaged data.
- ISO 639-3 raw tables are excluded due to redistribution restrictions; users must retrieve updates directly from SIL.
- Inventory sizes inherit PHOIBLE’s CC BY-SA 3.0 licensing, requiring share-alike compliance for downstream redistribution.


## Local Documentation Sync
- This file is the canonical docs-side copy of the dataset briefing. The daily improvement automation must rewrite this file and `docs/public-datasets/linguistics.mdx` whenever it changes the mounted `dataset_briefing.md`.
