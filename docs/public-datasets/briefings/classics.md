# Classics Dataset Briefing

## Overview
The `classics` corpus combines large-scale TEI XML texts from Open Greek and Latin’s First Thousand Years of Greek project, Perseus catalog metadata (MODS/MADS), the Pleiades ancient world gazetteer CSV exports, a Trismegistos geographic dump, and Wikidata SPARQL snapshots for classical authors, works, and ancient places. Together the mounted data span ~1.5 GB (uncompressed), interlinking literary, bibliographic, and geographic perspectives on the ancient Mediterranean and Near East.

## Data Inventory
- `dataset/open_greek_latin` (985 MB): 2,618 TEI XML texts in `First1KGreek/data`, aggregated metadata in `catalog.json` (1,201 works; 275,030 nodes; 25.6M Greek + 5.2M Latin words), CSV/TSV edition metadata (590 + 312 rows).
- `dataset/perseus` (285 MB): `catalog_data/mods` (13,371 MODS XML records) and `catalog_data/mads` (2,483 MADS authority files) plus CSV catalog extracts (`perseus_catalog_metadata.csv`, 13,370 rows; `perseus_phi_crosswalk.csv`, 5,823 rows).
- `dataset/pleiades` (161 MB): GIS CSV bundle updated 28 May 2025 with 17 normalized tables (`places.csv` 42,048 rows; `location_points.csv` 25,097; `connections.csv` 14,582; `names.csv` 42,939; vocabulary lookups) and distribution archive `pleiades_gis_data.zip`.
- `dataset/trismegistos` (38 MB): `trismegistos_geo_places.csv` (64,857 rows), matching `geo_dump.json` GeoJSON feature collection, and provenance `page.html` describing download options.
- `dataset/wikidata` (6.8 MB): SPARQL result snapshots (`ancient_places.json` 65 bindings; `classical_authors.json` ~13k bindings but contains control characters; `classical_literary_works.json` empty), preserving the standard head/results structure.

## Sources
- Open Greek and Latin First1KGreek repository (https://github.com/OpenGreekAndLatin/First1KGreek) — CC BY-SA 4.0, TEI texts and metadata with Hook coverage badges.
- Perseus Digital Library `catalog_data` (https://github.com/PerseusDL/catalog_data) — CC BY-SA 3.0, MODS/MADS bibliographic exports and crosswalks.
- Pleiades Gazetteer GIS exports (https://pleiades.stoa.org) — CC BY 3.0 terms, CSV extracts refreshed multiple times weekly (README updated 28 May 2025).
- Trismegistos Data Services Geo table (https://www.trismegistos.org) — download interface, license not bundled (consult TM terms).
- Wikidata Query Service snapshots (https://query.wikidata.org) — CC0 1.0, SPARQL results for places/authors/works.

## Schemas
- Edition metadata (`ogl_edition_metadata.csv`): filename, CTS URN, title, author, editor, publisher, publication year, citable units.
- New edition proposals (`First1KGreek/new_edition_metadata.csv`, TSV): filename, URNs, titles, editors, publishers, citation scheme.
- Perseus catalog (`perseus_catalog_metadata.csv`): URN, titles, authors, languages, dates, genres, related works, MODS path.
- Perseus PHI crosswalk (`perseus_phi_crosswalk.csv`): tradition, author, work, TLG/PHI numbers, availability status, standard edition citation, external identifiers.
- Pleiades core tables: `places.csv` (representative coordinates, bounding boxes, precision), `location_points.csv` / `location_polygons.csv` (geometry WKT, accuracy metrics, association certainty), `connections.csv` (typed relationships), `names.csv` (name types, language tags, attested/romanized forms), vocabulary CSVs keyed by `key`/`term`/`definition` columns, and `time_periods.csv` with lower/upper bounds.
- Trismegistos geo dump: `tm_geo_id`, standardized/vernacular names, status, modern country/region/province, begin/end dates, longitude, latitude.
- Wikidata JSON snapshots: SPARQL `head/vars` plus `results.bindings` objects containing URIs, labels, coordinates, and temporal qualifiers when available.

## Time Coverage
- Pleiades `time_periods.csv` spans approximately 2,600,000 BCE to 2,100 CE using standardized period vocabularies.
- Trismegistos geo entries indicate activity roughly from 1,539 BCE through 1,998 CE (mixed BC/AD string formats).
- First1KGreek texts target works composed before 1,000 CE, though metadata references 19th–20th century print editions.
- Wikidata snapshots reflect the query execution time embedded in the export (timestamp absent) and include modern descriptors.

## Geography Coverage
- Pleiades and Trismegistos emphasize Mediterranean, Near Eastern, and North African places with global coordinate coverage in WGS84.
- Wikidata `ancient_places` includes worldwide ancient settlements with modern country context.
- Textual corpora (First1KGreek, Perseus) are not geo-coded but align with the same classical world scope via CTS URNs and PHI/TLG identifiers.

## Formats
- TEI XML (`.xml`), MODS/MADS XML, GeoJSON, CSV, TSV, ZIP archives, and JSON SPARQL result sets coexist within the dataset.

## Transformations & Derived Fields
- Pleiades CSVs provide derived representative coordinates, concave accuracy hulls, period keys, and normalized vocabulary joins from the live gazetteer.
- First1KGreek `catalog.json` aggregates per-work word counts and Scaife reader links generated from source TEI metadata.
- Perseus crosswalk maps TLG/PHI identifiers to catalog records, enabling joins across corpora.
- Trismegistos geo dump denormalizes the TM database into a single place-level table for export.
- Wikidata snapshots capture SPARQL query outputs without further transformation; binding columns match query variables.

## Quality & Validation
- First1KGreek repository exposes Hook coverage badges tracking text, metadata, and word-count validation status.
- Perseus MODS/MADS files conform to Library of Congress schemas; CSV extracts originate from curated catalog workflows.
- Pleiades README documents QA practices, update cadence (multiple times weekly), and guidance on spatial precision and accuracy fields.
- Trismegistos export lacks accompanying QA metadata; rely on TM documentation for interpretive context.
- Wikidata data inherits community curation and WDQS availability; JSON snapshots remain unvalidated beyond export integrity.

## Limitations & Known Gaps
- `dataset/wikidata/classical_authors.json` includes control characters that break strict JSON parsing; lossy parsing (ignore errors) is required.
- `dataset/wikidata/classical_literary_works.json` currently returns zero bindings, indicating an empty or outdated query.
- Numerous Trismegistos rows lack `tm_geo_id` values and encode BC/AD dates as strings needing normalization.
- Pleiades period bounds carry BC/AD labels and textual numerals; numeric conversion requires custom parsing and careful handling of BCE millennia.
- Perseus catalog CSV contains placeholder `urn` values such as `none`, demanding filtering before establishing CTS joins.


## Local Documentation Sync
- This file is the canonical docs-side copy of the dataset briefing. The daily improvement automation must rewrite this file and `docs/public-datasets/classics.mdx` whenever it changes the mounted `dataset_briefing.md`.
