# Anthropology Dataset Briefing

## Overview
- Dataset id: `anthropology`.
- Current remote status at 2026-05-04T22:43:13.348Z: dataset `ready`, deployment `ready`.
- Registry of 14 anthropological data sources with harmonized metadata covering cultural, linguistic, archaeological, and gazetteer resources.
- Remote manifest path: `/mnt/alpha-research/datasets/anthropology/manifest.json`.
- This dataset is not a single universal normalized table. It is a collection of source-specific files, registries, tables, and document collections described below.

## Exact Data Currently Present
- Source summary: - sources where counted; status breakdown -.
- Current table/file inventory:

| Path | Rows | Columns | Grain | Time Coverage | Geography |
| --- | ---: | --- | --- | --- | --- |
| `dataset/source-registry.json` | - | - | - | - | - |

## Schemas And Fields
- `source_fields`: `id`; `title`; `description`; `categories`; `maintainer`; `coverage.spatial`; `coverage.temporal`; `coverage.entities`; `access.landing_page`; `access.downloads`; `access.api`; `access.formats`; `license.name`; `license.url`; `update.frequency`; `update.last_known_update`; `update.refresh_instructions`; `related`; `notes`

## Additional Assets
- No additional assets were listed in the saved profile.

## Time Coverage
- {"temporalDescriptions":[{"id":"dplace","description":"Primarily ethnographic records from the 19th and early 20th centuries with tagged focal years"},{"id":"whg-dplace","description":"Matches D-PLACE focal years"},{"id":"world-historical-gazetteer","description":"Multi-period"},{"id":"ehraf-metadata","description":"Prehistory to present"},{"id":"explaining-human-culture","description":"Studies spanning over 100 years"},{"id":"outline-world-cultures","description":"Multi-period"},{"id":"outline-cultural-materials","description":"Thematic"},{"id":"glottolog-cldf","description":"Current language metadata with historical references"},{"id":"open-context","description":"Archaeological and ethnographic records"},{"id":"tdar","description":"Archaeological investigations across time"},{"id":"seshat-cliopatria","description":"3400 BCE – 2024 CE"},{"id":"seshat-equinox","description":"Antiquity to early modern"},{"id":"dice","description":"Varies by compiled dataset"},{"id":"wikidata","description":"Historical and contemporary entities"}],"lastKnownUpdateRange":{"earliest":"2023-03-01","latest":"2026-04-20"}}

## Geography Coverage
- {"spatialDescriptions":["Global","International"]}

## Formats
- distribution: Atom to CLDF to CSV to GeoJSON to HTML to JSON to KML to LPF to PDF to Parquet to RDF to SKOS to TSV to TTL to TXT to Various (documents, datasets, images) to XLSX to XML to ZIP
- counts: {"CSV":4,"GeoJSON":3,"ZIP":2,"LPF":2,"TSV":1,"JSON":5,"HTML":4,"PDF":3,"RDF":2,"SKOS":1,"CLDF":1,"Atom":1,"KML":1,"XML":1,"Various (documents, datasets, images)":1,"XLSX":2,"TXT":1,"TTL":1,"Parquet":1}

## Transformations And Derived Fields
- notes: Metadata normalized to consistent field names (coverage.*, access.*, update.*). to Manual curation of relationships between datasets via related IDs.

## Quality And Validation
- checks: Programmatic enumeration of formats, categories, and last_known_update values completed 2026-05-02.
- issues: Manifest record count (13) does not match registry total (14); requires correction.

## Limitations And Known Gaps
- Registry excludes actual data payloads and access credentials; downstream acquisition required.
- Licensing details summarized from source notes and may need verification before redistribution.

## Local Documentation Sync
- This file is the canonical docs-side copy of the dataset briefing. The daily improvement automation must rewrite this file and `docs/public-datasets/anthropology.mdx` whenever it changes the mounted `dataset_briefing.md`.
