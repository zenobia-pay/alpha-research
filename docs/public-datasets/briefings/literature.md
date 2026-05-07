# Literature Dataset Briefing

## Overview
- Aggregated public-domain literature metadata combining Project Gutenberg, Internet Archive, Open Library, and Wikidata sources, with future integration stubs for HathiTrust, Standard Ebooks, and Chronicling America.
- Normalized focus on providing unified work and author entities with canonical identifiers, rights context, and resource URLs suitable for discovery or enrichment pipelines.

## Data Inventory
- `dataset/raw/project_gutenberg_gutendex.jsonl` — 300 records from Gutendex API pages filtered to English texts with downloadable formats.
- `dataset/raw/internet_archive_public_domain.jsonl` — 300 Internet Archive metadata rows meeting public-domain license filters.
- `dataset/raw/open_library_public_domain.jsonl` — 300 Open Library search results constrained to public-domain or public-scan availability.
- `dataset/raw/wikidata_works_authors.jsonl` — 200 SPARQL-sourced rows linking works, authors, and cross-identifiers.
- `dataset/normalized/works.jsonl` — 932 merged work entities referencing all ingested sources with normalized rights, identifiers, and access URLs.
- `dataset/normalized/authors.jsonl` — 722 distinct author authority entries derived from source metadata.
- `dataset/normalized/metrics.json` — rollups covering works-by-source, top languages (162 unique codes/labels), and rights statement distribution.
- `dataset/source-registry.json` — seven-provider registry detailing provenance, refresh cadence, and pending integrations.
- `dataset/refresh_notes.md` — operational log for the 2026-05-02 ingestion run, upstream query parameters, validation checklist, and enhancement roadmap.

## Sources
- Project Gutenberg (via Gutendex) — daily RDF/weekly text feeds; sampled through Gutendex for this build; localized asset `dataset/raw/project_gutenberg_gutendex.jsonl`.
- Internet Archive public-domain texts — advancedsearch Solr API; last checked 2026-05-02; contributes to normalized works.
- Open Library public-domain catalog — monthly dumps and realtime search API; ingestion filters ensure `public_scan_b` true or `ebook_access = "public"`.
- Wikidata literary entities — CC0 knowledge graph accessed through SPARQL; provides cross-IDs and author normalization.
- HathiTrust Extracted Features — documented but not yet ingested (access constraints); placeholder for future enrichment.
- Standard Ebooks — high-quality OPDS feeds; pipeline not yet implemented in this snapshot.
- Chronicling America — Library of Congress API and OCR dumps; catalogued for future historic newspaper integration.

## Schemas
- `works_v1` primary key `work_id`; fields cover source identifiers, title, author lists, normalized author references, language arrays, subjects, collection tags, usage metrics, publication timelines, rights/licensing, download URL map, preferred text URL, metadata URL, optional nested identifiers, and ingestion timestamp.
- `authors_v1` primary key `author_id`; includes display name, source author identifier, source system, and normalization timestamp.
- Raw JSONL feeds retain native source structures (e.g., Gutendex formats map, Internet Archive `collection` arrays, Open Library edition aggregations, Wikidata URIs) allowing re-normalization if schema evolves.

## Time Coverage
- Earliest reported publication date in normalized works: 1316-01-01; most recent: 2024-06-04 (derived from source metadata).
- Current ingestion timestamp for normalized assets: 2026-05-02T03:52:27Z; refresh guidance recommends monthly rebuild aligned to Open Library dumps.

## Geography Coverage
- Global corpus spanning at least 162 language codes/labels, with strong English representation and significant multilingual coverage (Spanish, French, German, Italian, Chinese, Portuguese, etc.).
- Rights statements emphasize U.S. public-domain status, implying best-fit usage within United States jurisdictions while noting international coverage via Wikidata and Open Library cross-references.

## Formats
- Raw and normalized data stored as UTF-8 newline-delimited JSON (`.jsonl`) plus supporting summary/config files as JSON and Markdown.
- Download URLs reference HTML, EPUB, MOBI, plain-text, and RDF formats for downstream retrieval.

## Transformations & Derived Fields
- Inline Python normalization script merges raw feeds, deduplicates works on canonical IDs, links authors via composite identifiers, and selects preferred text URLs.
- Rights statements standardized to descriptive text; license URLs propagated where available.
- Metrics rollup derives counts by source, language, and rights categories for quick QA trending.

## Quality & Validation
- `dataset/normalized/metrics.json` provides quantitative QA outputs; counts align with raw record totals (300+300+300+200 → 932 works).
- Refresh checklist mandates raw count tolerance, URL spot-checks, primary key uniqueness verification, language distribution monitoring, and capture of API headers for audit.
- Rights summary highlights concentration in "Project Gutenberg public domain" plus 276 records requiring follow-up due to unspecified or verbose statements.

## Limitations & Known Gaps
- HathiTrust, Standard Ebooks, and Chronicling America remain unintegrated; source registry notes required automation and access steps.
- Open Library search responses can include borrow-only items; normalization filters mitigate but may miss edge cases.
- Rights field normalization is incomplete for several Internet Archive and Open Library records; manual review recommended before redistribution.
- Publication dates are inconsistently populated (numerous `null` values) and may require additional parsing for precise temporal analytics.
- Language codes combine ISO-639 variants and plain-language strings (`eng`, `English`, `und`), necessitating harmonization for analytics work.


## Local Documentation Sync
- This file is the canonical docs-side copy of the dataset briefing. The daily improvement automation must rewrite this file and `docs/public-datasets/literature.mdx` whenever it changes the mounted `dataset_briefing.md`.
