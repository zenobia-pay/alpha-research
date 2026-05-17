# Canonical Public Datasets

This plan defines the evergreen public Alpha Research economics and humanities datasets. Each canonical dataset is a durable research environment, not a one-off analysis run.

## Product Contract

- Each canonical public dataset uses a short, stable id such as `econ`, `history`, or `literature`.
- They are public by default. Private uploads can join a research run, but should not mutate the canonical public dataset.
- Each canonical public dataset is backed by a durable Modal volume. The dataset is created when the catalog record and Modal volume identity exist; user-facing and maintenance readiness are derived from volume facts, writer locks, inventories, and profile proof instead of a single overloaded `ready` flag.
- Each dataset has a source registry, raw source files/API responses, data dictionary, quality report, raw inventory, and dataset briefing.
- Each dataset has a download inventory and raw inventory that explain exactly what was fetched, when, from where, and what native shape the raw source data has.
- Each dataset refreshes daily. Refresh jobs should update existing source snapshots, append new versions where history matters, and preserve source provenance.
- Each dataset also gets a daily expansion-planning run. This run reasons about missing coverage, new public sources, broken links, licensing constraints, and high-value additions for the field.
- Expansion-planning runs may propose new sources, but only sources that pass licensing, access, and reproducibility checks should become active fetch targets.

## Daily Job Shape

## Modal Volume Lifecycle

Canonical dataset lifecycle should be expressed as concrete facts:

- `volumeAvailable`: the Modal volume identity exists and the backend can mount it for a worker.
- `writerLocked`: one active bootstrap, refresh, improve, audit, or profile-sync operation currently owns the write lock.
- `improvable`: `volumeAvailable && !writerLocked`. Canonical improvement automation should use this as its write gate.
- `queryable`: the backend profile has a current briefing plus disk-inventory proof and readback verification. Queryability is useful for user-facing CLI behavior, but it is not a prerequisite for improvement jobs.
- `missingOrStale`: a list of repairable gaps such as `volume_inventory_proof`, `briefingMarkdown`, `legacy_status_reconciliation`, or `writer_lock`.

Legacy `status` and `deploymentStatus` values may still appear in API payloads for compatibility, but they are not the canonical maintenance gate. A dataset with `status: deploying` and no active writer lock can still be improvable when its Modal volume exists; the next bootstrap-repair or improvement job should reconcile metadata and profile proof.

For each canonical dataset, schedule these jobs:

1. `refresh`
   - Fetch from active public sources.
   - Preserve provider-native files/API responses in source-specific raw paths.
   - Validate source URLs, byte counts, hashes, native record counts, source coverage, license/access status, and fetch quality.
   - Publish `manifest.json`, `source_registry.csv`, `source_registry.plan.json`, `download_inventory.jsonl`, `download_inventory.csv`, `raw_inventory.jsonl`, `raw_inventory.csv`, `data_dictionary.md`, and `quality_report.md`.

## Provenance Inventory Contract

Every canonical refresh must make provenance inspectable without reading agent transcripts. A final row count without source provenance and native shape details is not sufficient.

`download_inventory.jsonl` and `download_inventory.csv` must include one record per attempted source download:

- Source id, source name, and plain-English description.
- Durable canonical/landing URL plus exact request URL or API endpoint used, with secrets redacted.
- Retrieval timestamp, retrieval method, HTTP status, raw output path, raw format, raw byte count, and SHA-256 hash.
- License or terms summary, access status, and failure/gating reason for deferred, credentialed, failed, or skipped sources.

`raw_inventory.jsonl` and `raw_inventory.csv` must include one record per raw source file/API response/document collection:

- Raw id/path, native format, byte count, row/document/object count when measurable, native field count, and content hash.
- Plain-English description of what each native row/object/document represents.
- Source id, canonical URL, request URL, retrieval timestamp, license/access status, and gating reason when relevant.
- Native primary keys or identifiers, native temporal coverage, native geography/topic coverage, and native schema/field descriptions.
- QA checks: fetch status, malformed files, missing source documentation, source caveats, redistribution limits, and known gaps.

`manifest.json`, `data_dictionary.md`, `quality_report.md`, and `dataset_briefing.md` must summarize these inventories. They must not define canonical analysis-ready tables.

2. `expand`
   - Read the dataset profile, prior expansion plans, and failed/deferred sources.
   - Search for newly relevant public datasets, archives, APIs, and corpus releases.
   - Classify each candidate as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, or `reject`.
   - Produce `expansion_plan.md` and update `source_registry.plan.json`.
   - Do not ingest newly discovered sources automatically unless they are clearly public, stable, machine-fetchable, and compatible with the dataset license.

3. `improve`
   - Start one remote Codex run for `econ` using `npm run canonical:improve`.
   - Inspect the mounted dataset, manifest, source registry, data dictionary, quality report, briefing, and previous improvement artifacts.
   - Search the internet with Exa using the remote `EXA_API_KEY`.
   - Classify newly discovered candidate sources as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, `not_found`, or `reject`.
   - Download public, stable, machine-fetchable `license_review` sources instead of blocking on review; mark them as `license_status: needs_review` in inventories and the result.
   - Every create, refresh, and improvement job must run with an authenticated Codex CLI/session and `CANONICAL_DATASET_SLACK_WEBHOOK_URL` in the remote runner environment. The webhook URL is a secret and must never be printed, logged, stored, or included in artifacts.
   - Append every download lifecycle event to dataset-root `download_events.jsonl`, and keep `download_inventory.jsonl` / `.csv` as the source of truth for attempted downloads.
   - Send or queue one Slack webhook alert for every terminal download attempt. Each alert must summarize what the data actually is, including subject/entities, geography, time coverage, units/measures, schema, row or object count when known, access/license status, blockers, and explicit not-present caveats when a filename could mislead. Log each delivery attempt in dataset-root `slack_download_alerts.jsonl` and summarize them in `slack_briefing.md`. Missing or failed Slack delivery must create pending/failed alert rows instead of silently disappearing.
   - Produce `improvement_plan.md`, `improvement_result.json`, `candidate_sources.csv`, `exa_search_log.json`, `download_events.jsonl`, `slack_download_alerts.jsonl`, and `slack_briefing.md`.

## Canonical Dataset Catalog

### Econ (`econ`)

Purpose: macroeconomics, labor, housing, inflation, credit, consumer behavior, regional economics, and business-cycle research.

Initial active/deferred source registry:

- Federal Reserve / FRED: https://fred.stlouisfed.org/
- U.S. Census Bureau: https://www.census.gov/data.html
- American Community Survey: https://www.census.gov/programs-surveys/acs/data.html
- Current Population Survey: https://www.census.gov/programs-surveys/cps.html
- American Housing Survey: https://www.census.gov/programs-surveys/ahs.html
- BLS data portal: https://www.bls.gov/data/
- Consumer Price Index: https://www.bls.gov/cpi/
- American Time Use Survey: https://www.bls.gov/tus/
- Consumer Expenditure Survey: https://www.bls.gov/cex/
- BEA data portal: https://www.bea.gov/data
- Personal Consumption Expenditures: https://www.bea.gov/data/consumer-spending/main
- FHFA Home Price Index: https://www.fhfa.gov/data/hpi
- Zillow research data: https://www.zillow.com/research/data/
- Zillow Home Value Index: https://www.zillow.com/research/data/
- Redfin Data Center: https://www.redfin.com/news/data-center/
- National Association of Realtors research and statistics: https://www.nar.realtor/research-and-statistics
- Case-Shiller Index: https://www.spglobal.com/spdji/en/index-family/corelogic-sp-case-shiller/
- CoreLogic home price insights: https://www.corelogic.com/intelligence/us-home-price-insights/
- Freddie Mac AIMI: https://mf.freddiemac.com/aimi
- Fannie Mae surveys: https://www.fanniemae.com/research-and-insights/surveys
- Federal Reserve Senior Loan Officer Opinion Survey: https://www.federalreserve.gov/data/sloos.htm
- Federal Reserve Bank of New York data: https://www.newyorkfed.org/data-and-statistics
- NBER: https://www.nber.org/
- IMF data: https://www.imf.org/en/Data
- ONS: https://www.ons.gov.uk/
- Pew Research Center: https://www.pewresearch.org/
- General Social Survey: https://gss.norc.org/
- Panel Study of Income Dynamics: https://psidonline.isr.umich.edu/
- Apartment List rent estimates: https://www.apartmentlist.com/research/category/data-rent-estimates

Priority raw source families:

- Preserve provider-native raw files, API responses, codebooks, schemas, and public documentation for the source families above.
- Do not define canonical analysis tables for this dataset; computed tables belong to separate run artifacts.
- Keep exact raw shape, provenance, license/access status, coverage, hashes, and source caveats in `raw_inventory.*` and `dataset_briefing.md`.

### History (`history`)

Purpose: public archival records, newspapers, government documents, maps, manuscripts, oral histories, gazetteers, and historical metadata for social, political, cultural, and economic history.

Initial active/deferred source registry:

- Library of Congress digital collections: https://www.loc.gov/collections/ (active_fetchable)
- National Archives catalog: https://catalog.archives.gov/ (active_fetchable)
- Chronicling America newspapers: https://chroniclingamerica.loc.gov/ (active_fetchable)
- HathiTrust bibliographic and public-domain metadata: https://www.hathitrust.org/ (license_review)
- Europeana API and datasets: https://pro.europeana.eu/page/apis (active_fetchable)
- Digital Public Library of America API: https://pro.dp.la/developers/api-codex (active_fetchable)
- Wikidata dumps: https://www.wikidata.org/wiki/Wikidata:Database_download (active_fetchable)
- Harvard Dataverse history collections: https://dataverse.harvard.edu/ (active_fetchable)

Priority raw source families:

- Preserve provider-native archival metadata, document manifests, OCR/text exports, API responses, codebooks, public documentation, rights statements, place/time metadata, and collection-level provenance.
- Keep subfields such as medieval studies, digital humanities, area studies, and legal history as source families unless later split into dedicated canonical datasets.
- Classify every source as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, or `reject`.

### Literature (`literature`)

Purpose: public-domain texts, bibliographic metadata, editions, authorship records, genre metadata, translations, and text corpora for literary research.

Initial active/deferred source registry:

- Project Gutenberg catalog and texts: https://www.gutenberg.org/ (active_fetchable)
- Internet Archive text collections: https://archive.org/details/texts (active_fetchable)
- HathiTrust metadata and public-domain records: https://www.hathitrust.org/ (license_review)
- Open Library data dumps: https://openlibrary.org/developers/dumps (active_fetchable)
- Wikisource dumps: https://dumps.wikimedia.org/ (active_fetchable)
- Perseus Digital Library texts: https://www.perseus.tufts.edu/ (license_review)

Priority raw source families:

- Preserve source-native text files, metadata dumps, catalog exports, edition-level records, language fields, authorship metadata, and license/rights statements.
- Do not normalize editions, translations, authors, or works into a shared literary model inside the canonical dataset.
- Classify every source as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, or `reject`.

### Philosophy (`philosophy`)

Purpose: public-domain philosophical texts, encyclopedia/reference metadata, bibliographies, author/work metadata, and open teaching or citation corpora where licensing permits.

Initial active/deferred source registry:

- PhilPapers metadata: https://philpapers.org/ (license_review)
- Stanford Encyclopedia of Philosophy pages and metadata: https://plato.stanford.edu/ (license_review)
- Internet Archive philosophy collections: https://archive.org/ (active_fetchable)
- Project Gutenberg philosophy texts: https://www.gutenberg.org/ (active_fetchable)
- Wikisource philosophy texts: https://dumps.wikimedia.org/ (active_fetchable)
- Open Syllabus public references: https://opensyllabus.org/ (license_review)

Priority raw source families:

- Preserve provider-native bibliographic records, public-domain texts, page snapshots where allowed, topic taxonomies, author metadata, and license/terms evidence.
- Treat copyrighted encyclopedia pages, paid indexes, and redistribution-unclear metadata as `license_review` or `credential_required`.
- Classify every source as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, or `reject`.

### Religion (`religion`)

Purpose: public religious texts, translations, commentaries, liturgical materials, religious studies metadata, textual corpora, and historical religious-source collections.

Initial active/deferred source registry:

- Internet Sacred Text Archive: https://sacred-texts.com/ (license_review)
- Sefaria public data/API: https://www.sefaria.org/developers (active_fetchable)
- Quran corpus and public translations: https://corpus.quran.com/ (license_review)
- Perseus religious and classical texts: https://www.perseus.tufts.edu/ (license_review)
- Internet Archive religion collections: https://archive.org/ (active_fetchable)
- Wikisource religious texts: https://dumps.wikimedia.org/ (active_fetchable)

Priority raw source families:

- Preserve native text structures, translation/version identifiers, commentary metadata, public API responses, source-language fields, and license/rights notes.
- Do not merge traditions, editions, translations, or commentaries into a common schema inside the canonical package.
- Classify every source as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, or `reject`.

### Classics (`classics`)

Purpose: Greek and Latin texts, inscriptions, papyri, prosopography, ancient places, classical reception metadata, and archaeological/historical source catalogs.

Initial active/deferred source registry:

- Perseus Digital Library: https://www.perseus.tufts.edu/ (license_review)
- Packard Humanities Institute classical resources: https://latin.packhum.org/ (license_review)
- Pleiades ancient places: https://pleiades.stoa.org/ (active_fetchable)
- Trismegistos metadata: https://www.trismegistos.org/ (license_review)
- Open Greek and Latin: https://opengreekandlatin.org/ (active_fetchable)
- Epigraphic Database Heidelberg: https://edh.ub.uni-heidelberg.de/ (license_review)

Priority raw source families:

- Preserve TEI/XML, text files, inscription records, place records, prosopographical metadata, source documentation, and licensing evidence in source-specific paths.
- Keep archaeology and ancient-history overlap as source families unless a later split is justified.
- Classify every source as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, or `reject`.

### Art History (`art-history`)

Purpose: museum open collections, artwork/object metadata, artist authority files, image metadata, provenance records, vocabularies, and cultural-heritage aggregation sources.

Initial active/deferred source registry:

- Wikimedia Commons structured data dumps: https://commons.wikimedia.org/wiki/Commons:Database_download (active_fetchable)
- Getty vocabularies: https://www.getty.edu/research/tools/vocabularies/ (active_fetchable)
- Metropolitan Museum of Art Open Access: https://metmuseum.github.io/ (active_fetchable)
- Rijksmuseum API: https://data.rijksmuseum.nl/object-metadata/api/ (active_fetchable)
- Art Institute of Chicago API: https://api.artic.edu/docs/ (active_fetchable)
- Europeana API and datasets: https://pro.europeana.eu/page/apis (active_fetchable)

Priority raw source families:

- Preserve native museum object records, API payloads, image metadata, IIIF manifests where available, vocabularies, provenance fields, rights statements, and collection documentation.
- Do not merge object, artist, place, or image records into a shared art-history entity graph inside the canonical package.
- Classify every source as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, or `reject`.

### Musicology (`musicology`)

Purpose: music bibliographic metadata, works and recordings, public-domain scores, performance metadata, authority records, audio collections, and music-history source catalogs.

Initial active/deferred source registry:

- MusicBrainz database dumps: https://musicbrainz.org/doc/MusicBrainz_Database/Download (active_fetchable)
- IMSLP metadata and public-domain scores: https://imslp.org/ (license_review)
- Internet Archive audio and music metadata: https://archive.org/details/audio (active_fetchable)
- Library of Congress music collections: https://www.loc.gov/collections/?fa=partof:music+division (active_fetchable)
- Wikidata music entities: https://www.wikidata.org/wiki/Wikidata:Database_download (active_fetchable)
- Choral Public Domain Library: https://www.cpdl.org/ (license_review)

Priority raw source families:

- Preserve provider-native work, recording, score, collection, rights, authority, and audio metadata with source-specific documentation.
- Treat score files and audio objects as license-sensitive; include rights status and redistribution limits in inventories.
- Classify every source as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, or `reject`.

### Theater & Performance (`theater-performance`)

Purpose: plays, productions, venues, performers, performance metadata, public-domain scripts, reviews, and theater-history source collections.

Initial active/deferred source registry:

- Internet Broadway Database metadata: https://www.ibdb.com/ (license_review)
- Playbill production metadata: https://playbill.com/ (license_review)
- Folger Shakespeare public resources: https://www.folger.edu/explore/shakespeares-works/ (license_review)
- Project Gutenberg plays: https://www.gutenberg.org/ (active_fetchable)
- Wikidata performing arts entities: https://www.wikidata.org/wiki/Wikidata:Database_download (active_fetchable)
- Internet Archive theater collections: https://archive.org/ (active_fetchable)

Priority raw source families:

- Preserve native play texts, production records, performer/venue metadata, public API responses, archival metadata, source documentation, and rights statements.
- Treat production databases and reviews as license-sensitive until terms are recorded.
- Classify every source as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, or `reject`.

### Linguistics (`linguistics`)

Purpose: language catalogs, typological databases, phonological inventories, lexical concepts, treebanks, corpora metadata, and interoperable linguistic datasets.

Initial active/deferred source registry:

- CLDF datasets: https://cldf.clld.org/ (active_fetchable)
- World Atlas of Language Structures: https://wals.info/ (active_fetchable)
- Glottolog: https://glottolog.org/ (active_fetchable)
- PHOIBLE: https://phoible.org/ (active_fetchable)
- Concepticon: https://concepticon.clld.org/ (active_fetchable)
- Universal Dependencies: https://universaldependencies.org/ (active_fetchable)
- Leipzig Corpora Collection: https://wortschatz.uni-leipzig.de/en/download/ (license_review)

Priority raw source families:

- Preserve CLDF packages, catalog dumps, feature tables, treebanks, README/codebook files, native identifiers, language codes, and license notes.
- Do not harmonize language identifiers or typological features into a shared analysis table inside the canonical package.
- Classify every source as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, or `reject`.

### Anthropology (`anthropology`)

Purpose: archaeological records, ethnographic metadata, cultural trait datasets, museum collections, place/entity gazetteers, and public anthropology-adjacent research datasets.

Initial active/deferred source registry:

- Open Context archaeology data: https://opencontext.org/ (active_fetchable)
- tDAR metadata and public records: https://www.tdar.org/ (license_review)
- D-PLACE cultural and environmental data: https://d-place.org/ (active_fetchable)
- eHRAF World Cultures metadata (credential/deferred only): https://ehrafworldcultures.yale.edu/ (credential_required)
- Archaeological gazetteers, including Pleiades ancient places: https://pleiades.stoa.org/ (active_fetchable)
- Museum open collections, including Smithsonian Open Access: https://www.si.edu/openaccess (active_fetchable)
- Museum open collections, including Metropolitan Museum of Art Open Access: https://metmuseum.github.io/ (active_fetchable)
- Harvard Dataverse anthropology collections: https://dataverse.harvard.edu/ (active_fetchable)

Priority raw source families:

- Preserve native archaeological records, cultural trait datasets, museum object metadata, site/place records, codebooks, documentation, and terms evidence.
- Treat tDAR as `license_review` until terms are reviewed; treat eHRAF as credential/deferred only and do not fetch without platform-approved access.
- Keep archaeology, museum studies, and area studies as source families unless later split into dedicated canonical datasets.
- Classify every source as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, or `reject`.


## Implementation Plan

1. Create or reuse the public environment for each canonical dataset.
2. Persist canonical dataset ids as backend seed data so `list_remote_datasets` shows them before the first refresh completes.
3. Add scheduler config for refresh, expand, and improve jobs.
4. Run `refresh` jobs on the ingest worker and `expand` jobs as remote agent runs against the mounted dataset.
5. Add dashboard affordances for public/private, refresh status, last successful manifest, next scheduled refresh, and latest expansion plan.
6. Gate expansion-plan promotions through source status: active public sources can be ingested automatically; credentialed, paid, unclear-license, or brittle sources require human review.
7. Add product tests that assert `econ` exists, is public, has a source registry, and produces refresh/expansion artifacts.

## Initial CLI Prompts

Use these prompts with `create_public_data_environment` or the signed-in `research --prompt` flow.

### Econ

Create or extend the public canonical dataset `econ` named `Econ`. Build a durable economics research environment from the source registry in `docs/CANONICAL_PUBLIC_DATASETS.md`. Fetch representative active public raw sources first, preserve source URLs and native file/API shapes, write `source_registry.csv`, `source_registry.plan.json`, `manifest.json`, `raw_inventory.jsonl`, `raw_inventory.csv`, `data_dictionary.md`, `quality_report.md`, and a dataset briefing. Mark sources that need credentials, unclear licensing, or expensive access as deferred rather than failing the build.
