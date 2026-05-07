# Philosophy Dataset Briefing

## Overview
Consolidated snapshot (retrieved 2026-05-02T03:54:26Z) of public-domain and open-access philosophy reference metadata spanning encyclopedia entries, bibliographic catalogs, and Wikidata extracts for people and works.

## Data Inventory
- `sep_entries.parquet`: 1,615 Stanford Encyclopedia of Philosophy table-of-contents rows with sections, titles, authors, and entry URLs.
- `iep_articles.parquet`: 910 Internet Encyclopedia of Philosophy WordPress entries with metadata, categorization lists, and publication timestamps.
- `philpapers_top_categories.csv`: 56 PhilPapers top-level category counts plus global indexed total.
- `project_gutenberg_philosophy.parquet`: 6,749 Project Gutenberg catalog rows filtered to philosophy-related LoC class B or tagged subjects.
- `internet_archive_public_domain_philosophy.parquet`: 1,000 high-download pre-1928 Internet Archive texts with descriptive metadata and download counts.
- `wikidata_philosophers.parquet`: 1,000 Wikidata philosopher entities with birth/death strings, nationalities, movements, and influence relationships.
- `wikidata_philosophy_works.parquet`: 1,000 Wikidata philosophical works with descriptive fields, authors, and subject tags.

## Sources
- Stanford Encyclopedia of Philosophy contents page (`https://plato.stanford.edu/contents.html`), metadata © 2026 Metaphysics Research Lab, scraped via HTML parsing of the contents div.
- Internet Encyclopedia of Philosophy REST API (`https://iep.utm.edu/wp-json/wp/v2/posts`), open-access WordPress metadata with pagination.
- PhilPapers front page summary (`https://philpapers.org/`), manually transcribed top-category counts as of 2026-05-02 (refresh requires site/API access).
- Project Gutenberg catalog feed (`https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv`), public-domain metadata filtered for philosophy subjects or LoC class B.
- Internet Archive advanced search (`https://archive.org/advancedsearch.php`), constrained to subject=philosophy, mediatype=texts, date ≤ 1927, sorted by downloads.
- Wikidata SPARQL endpoint (`https://query.wikidata.org/`), CC0 data for philosophers (occupation Q4964182) and philosophical works (instance Q40444998).

## Schemas
- `sep_entries`: retrieved_at, section, slug, title, authors, entry_url (all strings).
- `iep_articles`: retrieved_at, id (int64), slug, status, type, title, excerpt, link, date, modified, author_id (int64), category_ids (list<int64>), category_names (list<string>), tags (list<null>).
- `philpapers_top_categories`: total_indexed_entries (int64), retrieved_at, category, entry_count (int64).
- `project_gutenberg_philosophy`: retrieved_at, Text# (int64), Type, Issued, Title, Language, Authors, Subjects, LoCC, Bookshelves (strings).
- `internet_archive_public_domain_philosophy`: retrieved_at, identifier, title, creator, issued, language, publisher, downloads (int64), subjects, collections, license, source_url.
- `wikidata_philosophers`: retrieved_at, wikidata_id, label, description, birth, death, nationalities, movements, influenced_by, notable_works (strings).
- `wikidata_philosophy_works`: retrieved_at, wikidata_id, label, description, publication_date, authors, subjects (strings).

## Time Coverage
- Overall temporal span: earliest philosopher birth year ≈ 0015 CE to latest death entries recorded as 2026, with bibliographic issue dates spanning 1111–2026.
- `iep_articles` publication dates range 2001–2026 (WordPress timestamps).
- `philpapers_top_categories` reflects a single snapshot (2026-05-02).
- `project_gutenberg_philosophy` release timestamps range 1971–2026 (Gutenberg issue dates, not original publication years).
- `internet_archive_public_domain_philosophy` issued years range 1111–1927 (public-domain cutoff applied).
- `wikidata_philosophers` birth/death strings range 0015–2026; `wikidata_philosophy_works` publication_date values mostly 2000–2001 due to sampling limits.

## Geography Coverage
- Global scope: Wikidata nationalities field spans multiple continents; encyclopedia sources cover worldwide philosophical topics though without standardized geographic codes. No explicit geospatial coordinates are included.

## Formats
- Primary storage in columnar `parquet` files (six tables) plus one `csv` snapshot for PhilPapers category counts.

## Transformations & Derived Fields
- All tables include a unified `retrieved_at` ingestion timestamp (2026-05-02T03:54:26Z).
- Project Gutenberg subset filtered by subject keywords or Library of Congress class `B`.
- Internet Archive subset filtered by subject=philosophy, public-domain date cutoff, and sorted by downloads to cap at 1,000 rows.
- Wikidata extracts rely on SPARQL queries aggregating list fields via `GROUP_CONCAT` (nationalities, subjects, influences) into pipe-delimited strings.
- PhilPapers counts manually entered from front-page summary; total indexed entries duplicated per row.

## Quality & Validation
- Source-level counts align with manifest totals (CSV registry). No cross-source deduplication performed; overlapping works/authors likely.
- PhilPapers counts depend on manual transcription; spot checks recommended when refreshing.
- Wikidata string fields may contain language codes or formatting artifacts from `GROUP_CONCAT`; no post-processing to ISO standards.
- Internet Archive language codes vary (`eng`, `English`, `eng; grc`), indicating inconsistent catalog metadata.

## Limitations & Known Gaps
- Dataset omits full text content; only descriptive metadata retained.
- `wikidata_philosophy_works` publication dates sparsely populated (only two years captured) because of service paging limits.
- `iep_articles` tags list is empty for current snapshot; category coverage may shift with future API changes.
- PhilPapers component lacks historical time series or subcategory hierarchy beyond top level.
- No harmonized identifiers across sources, so linking across tables requires custom matching.


## Local Documentation Sync
- This file is the canonical docs-side copy of the dataset briefing. The daily improvement automation must rewrite this file and `docs/public-datasets/philosophy.mdx` whenever it changes the mounted `dataset_briefing.md`.
