# Canonical Public Datasets

This plan defines evergreen, public Alpha Research datasets for broad humanities and social-science fields. Each canonical dataset is a durable research environment, not a one-off analysis run.

## Product Contract

- Canonical datasets use short, human names and stable ids: `econ`, `philosophy`, `sociology`, etc.
- They are public by default. Private uploads can join a research run, but should not mutate the canonical public dataset.
- Each dataset has a source registry, normalized tables/documents, data dictionary, quality report, and dataset briefing.
- Each dataset has a download inventory and normalization inventory that explain exactly what was fetched, when, from where, and how raw inputs became normalized outputs.
- Each dataset refreshes daily. Refresh jobs should update existing source snapshots, append new versions where history matters, and preserve source provenance.
- Each dataset also gets a daily expansion-planning run. This run reasons about missing coverage, new public sources, broken links, licensing constraints, and high-value additions for the field.
- Expansion-planning runs may propose new sources, but only sources that pass licensing, access, and reproducibility checks should become active fetch targets.

## Daily Job Shape

For every canonical dataset, schedule two jobs:

1. `refresh`
   - Fetch from active public sources.
   - Normalize into the existing schema or add versioned tables when a source changes shape.
   - Validate source URLs, row counts, missingness, join keys, temporal coverage, and geography/topic coverage.
   - Publish `manifest.json`, `source_registry.csv`, `source_registry.plan.json`, `download_inventory.jsonl`, `download_inventory.csv`, `normalization_inventory.jsonl`, `normalization_inventory.csv`, `data_dictionary.md`, and `quality_report.md`.

## Provenance Inventory Contract

Every canonical refresh must make provenance inspectable without reading agent transcripts. A final row count without source and transform provenance is not sufficient.

`download_inventory.jsonl` and `download_inventory.csv` must include one record per attempted source download:

- Source id, source name, and plain-English description.
- Durable canonical/landing URL plus exact request URL or API endpoint used, with secrets redacted.
- Retrieval timestamp, retrieval method, HTTP status, raw output path, raw format, raw byte count, and SHA-256 hash.
- License or terms summary, access status, and failure/gating reason for deferred, credentialed, failed, or skipped sources.

`normalization_inventory.jsonl` and `normalization_inventory.csv` must include one record per normalized table or document collection:

- Output id/path, output format, row or document count, column or field count, and content hash.
- Plain-English description of what each row or document represents.
- Source ids and raw/intermediate input paths used.
- Grain, primary keys, join keys, temporal coverage, geography/topic coverage, and schema with plain-English field descriptions.
- Ordered transform steps: cleaning, filtering, reshaping, joins, aggregation, imputation, unit conversion, and derived fields.
- QA checks: row counts, missingness, uniqueness, join coverage, range checks, caveats, and known gaps.

`manifest.json`, `data_dictionary.md`, `quality_report.md`, and `dataset_briefing.md` must summarize these inventories.

2. `expand`
   - Read the dataset profile, prior expansion plans, and failed/deferred sources.
   - Search for newly relevant public datasets, archives, APIs, and corpus releases.
   - Classify each candidate as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, or `reject`.
   - Produce `expansion_plan.md` and update `source_registry.plan.json`.
   - Do not ingest newly discovered sources automatically unless they are clearly public, stable, machine-fetchable, and compatible with the dataset license.

3. `improve`
   - Start one remote Codex run per ready canonical dataset using `npm run canonical:improve`.
   - Inspect the mounted dataset, manifest, source registry, data dictionary, quality report, briefing, and previous improvement artifacts.
   - Search the internet with Exa using the remote `EXA_API_KEY`.
   - Classify newly discovered candidate sources as `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, `not_found`, or `reject`.
   - Send a Slack webhook alert through `CANONICAL_DATASET_SLACK_WEBHOOK_URL` for high-value `not_found`, `credential_required`, or license-review candidates that need human action.
   - Produce `improvement_plan.md`, `improvement_result.json`, `candidate_sources.csv`, and `exa_search_log.json`.

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

Priority normalized tables:

- `macro_series`: national and regional time series from FRED, BEA, BLS, IMF, ONS, and NBER.
- `labor_market`: employment, unemployment, wages, hours, occupations, CPS, ATUS, and CEX-derived measures.
- `housing_market`: HPI, rents, home values, listings, affordability, mortgage indicators, and survey measures.
- `credit_finance`: rates, lending standards, debt, delinquencies, credit conditions, and bank survey measures.
- `demographics_income`: ACS, Census, CPS, income, population, household, and geographic covariates.
- `source_registry`: source metadata, licensing/access notes, fetch status, coverage, and update cadence.

### Sociology (`sociology`)

Purpose: social structure, inequality, demographics, institutions, family, work, religion, politics, mobility, health, and social attitudes.

Recommended starting sources:

- General Social Survey: https://gss.norc.org/
- IPUMS USA: https://usa.ipums.org/usa/
- IPUMS CPS: https://cps.ipums.org/cps/
- American Community Survey: https://www.census.gov/programs-surveys/acs/data.html
- Current Population Survey: https://www.census.gov/programs-surveys/cps.html
- Panel Study of Income Dynamics: https://psidonline.isr.umich.edu/
- National Longitudinal Surveys: https://www.nlsinfo.org/
- Add Health: https://addhealth.cpc.unc.edu/
- World Values Survey: https://www.worldvaluessurvey.org/
- European Social Survey: https://www.europeansocialsurvey.org/
- Pew Research Center: https://www.pewresearch.org/
- ANES: https://electionstudies.org/
- ICPSR: https://www.icpsr.umich.edu/
- OpenICPSR: https://www.openicpsr.org/
- Our World in Data: https://ourworldindata.org/
- OECD Data Explorer: https://data-explorer.oecd.org/
- World Bank Data: https://data.worldbank.org/
- CDC data: https://data.cdc.gov/
- Bureau of Justice Statistics: https://bjs.ojp.gov/data
- FBI Crime Data Explorer: https://cde.ucr.cjis.gov/

Priority normalized tables/documents:

- `survey_responses`, `demographics`, `attitudes`, `households_families`, `education_work`, `religion_politics`, `health_crime`, `codebooks`, `source_registry`.

### Philosophy (`philosophy`)

Purpose: canonical texts, contemporary papers, concepts, argument structures, author networks, bibliographic metadata, and teaching/research corpora.

Recommended starting sources:

- Stanford Encyclopedia of Philosophy: https://plato.stanford.edu/
- Internet Encyclopedia of Philosophy: https://iep.utm.edu/
- PhilPapers: https://philpapers.org/
- PhilArchive: https://philarchive.org/
- Open Syllabus: https://opensyllabus.org/
- HathiTrust Research Center: https://analytics.hathitrust.org/
- Project Gutenberg philosophy bookshelf: https://www.gutenberg.org/ebooks/bookshelf/57
- Perseus Digital Library: https://www.perseus.tufts.edu/
- Wikidata philosophy entities: https://www.wikidata.org/
- DBpedia: https://www.dbpedia.org/
- OpenAlex works/authors: https://openalex.org/
- Crossref: https://www.crossref.org/
- CORE: https://core.ac.uk/
- Semantic Scholar: https://www.semanticscholar.org/
- Internet Archive texts: https://archive.org/details/texts

Priority normalized tables/documents:

- `works`, `authors`, `concepts`, `citations`, `abstracts`, `full_text_public_domain`, `encyclopedia_entries`, `syllabus_mentions`, `source_registry`.

### History (`history`)

Purpose: primary-source corpora, historical newspapers, census and demographic series, event chronologies, geographies, and historiographic metadata.

Recommended starting sources:

- Library of Congress digital collections: https://www.loc.gov/collections/
- Chronicling America: https://chroniclingamerica.loc.gov/
- National Archives catalog: https://catalog.archives.gov/
- Digital Public Library of America: https://dp.la/
- HathiTrust Research Center: https://analytics.hathitrust.org/
- Internet Archive texts: https://archive.org/details/texts
- Europeana: https://www.europeana.eu/
- Wikidata historical entities: https://www.wikidata.org/
- World Historical Gazetteer: https://whgazetteer.org/
- IPUMS NHGIS: https://www.nhgis.org/
- Census historical data: https://www.census.gov/history/www/reference/data/
- Our World in Data: https://ourworldindata.org/
- Clio Infra: https://clio-infra.eu/
- OpenHistoricalMap: https://www.openhistoricalmap.org/

Priority normalized tables/documents:

- `documents`, `newspapers`, `archives`, `places`, `events`, `people_organizations`, `time_series`, `metadata_codebooks`, `source_registry`.

### Literature (`literature`)

Purpose: public-domain texts, bibliographic metadata, authorship, genre, reception, editions, literary movements, and computational text-analysis corpora.

Recommended starting sources:

- Project Gutenberg: https://www.gutenberg.org/
- Internet Archive texts: https://archive.org/details/texts
- HathiTrust Research Center: https://analytics.hathitrust.org/
- Open Library: https://openlibrary.org/developers/api
- Library of Congress: https://www.loc.gov/apis/
- Wikidata literary works/authors: https://www.wikidata.org/
- OpenAlex: https://openalex.org/
- Crossref: https://www.crossref.org/
- Europeana: https://www.europeana.eu/
- Perseus Digital Library: https://www.perseus.tufts.edu/
- TextGrid Repository: https://textgridrep.org/
- Early English Books Online TCP: https://textcreationpartnership.org/tcp-texts/eebo-tcp-early-english-books-online/

Priority normalized tables/documents:

- `works`, `authors`, `editions`, `full_text_public_domain`, `genres_movements`, `citations_reception`, `source_registry`.

### Political Science (`political-science`)

Purpose: elections, public opinion, institutions, legislation, conflict, international relations, political economy, and comparative politics.

Recommended starting sources:

- ANES: https://electionstudies.org/
- Comparative Study of Electoral Systems: https://cses.org/
- MIT Election Data and Science Lab: https://electionlab.mit.edu/data
- Voteview: https://voteview.com/data
- Congress.gov: https://www.congress.gov/
- GovInfo: https://www.govinfo.gov/
- FEC data: https://www.fec.gov/data/
- OpenSecrets: https://www.opensecrets.org/
- Manifesto Project: https://manifesto-project.wzb.eu/
- V-Dem: https://www.v-dem.net/
- Polity Project: https://www.systemicpeace.org/polityproject.html
- World Bank Governance Indicators: https://www.worldbank.org/en/publication/worldwide-governance-indicators
- UCDP: https://ucdp.uu.se/
- Correlates of War: https://correlatesofwar.org/
- ICEWS Dataverse: https://dataverse.harvard.edu/dataverse/icews

Priority normalized tables/documents:

- `elections`, `public_opinion`, `legislators_votes`, `campaign_finance`, `parties_manifestos`, `institutions`, `conflict_events`, `country_year`, `source_registry`.

### Anthropology (`anthropology`)

Purpose: ethnographic metadata, cultural traits, language, archaeology, human geography, kinship, migration, and material culture.

Recommended starting sources:

- eHRAF World Cultures: https://hraf.yale.edu/products/ehraf-world-cultures/
- eHRAF Archaeology: https://hraf.yale.edu/products/ehraf-archaeology/
- D-PLACE: https://d-place.org/
- Human Relations Area Files: https://hraf.yale.edu/
- Glottolog: https://glottolog.org/
- Ethnologue public language metadata: https://www.ethnologue.com/
- WALS: https://wals.info/
- Open Context archaeology data: https://opencontext.org/
- tDAR: https://www.tdar.org/
- ARIADNEplus: https://ariadne-infrastructure.eu/
- Smithsonian collections: https://www.si.edu/openaccess
- GBIF for human-environment context: https://www.gbif.org/

Priority normalized tables/documents:

- `cultures`, `languages`, `traits`, `ethnographic_sources`, `archaeology_sites`, `artifacts`, `places`, `source_registry`.

### Linguistics (`linguistics`)

Purpose: languages, typology, corpora, phonology, syntax, lexical resources, language families, and endangered-language documentation.

Recommended starting sources:

- Glottolog: https://glottolog.org/
- WALS: https://wals.info/
- PHOIBLE: https://phoible.org/
- CLDF datasets: https://cldf.clld.org/
- Lexibank: https://lexibank.clld.org/
- Universal Dependencies: https://universaldependencies.org/
- CHILDES/TalkBank: https://childes.talkbank.org/
- Common Voice: https://commonvoice.mozilla.org/
- OLAC: http://www.language-archives.org/
- ELAR: https://www.elararchive.org/
- PARADISEC: https://www.paradisec.org.au/
- Leipzig Corpora Collection: https://wortschatz.uni-leipzig.de/en/download

Priority normalized tables/documents:

- `languages`, `features`, `phoneme_inventories`, `lexicons`, `treebanks`, `speech_corpora`, `archives`, `source_registry`.

### Classics (`classics`)

Purpose: Greek and Latin corpora, inscriptions, papyri, editions, translations, places, persons, and material culture.

Recommended starting sources:

- Perseus Digital Library: https://www.perseus.tufts.edu/
- Open Greek and Latin: https://opengreekandlatin.org/
- Packard Humanities Institute Latin texts: https://latin.packhum.org/
- Papyri.info: https://papyri.info/
- Trismegistos: https://www.trismegistos.org/
- Epigraphic Database Heidelberg: https://edh.ub.uni-heidelberg.de/
- EAGLE Europeana Network: https://www.eagle-network.eu/
- Pleiades Gazetteer: https://pleiades.stoa.org/
- Pelagios: https://pelagios.org/
- Nomisma: https://nomisma.org/
- British Museum collection data: https://www.britishmuseum.org/collection
- Wikidata classical entities: https://www.wikidata.org/

Priority normalized tables/documents:

- `texts`, `authors`, `works`, `translations`, `inscriptions`, `papyri`, `places`, `persons`, `artifacts`, `source_registry`.

## Implementation Plan

1. Create or reuse public environments for the canonical ids, starting with `econ`, `sociology`, and `philosophy`.
2. Persist this catalog as backend seed data so `list_remote_datasets` shows the canonical public datasets even before the first refresh completes.
3. Add a scheduler table or config with one row per `{datasetId, jobType}` and daily cadence.
4. Run `refresh` jobs on the ingest worker and `expand` jobs as remote agent runs against the mounted dataset.
5. Add dashboard affordances for public/private, refresh status, last successful manifest, next scheduled refresh, and latest expansion plan.
6. Gate expansion-plan promotions through source status: active public sources can be ingested automatically; credentialed, paid, unclear-license, or brittle sources require human review.
7. Add product tests that assert canonical datasets exist, are public, have source registries, and produce refresh/expansion artifacts.

## Initial CLI Prompts

Use these prompts with `create_public_data_environment` or the signed-in `research --prompt` flow.

### Econ

Create or extend the public canonical dataset `econ` named `Econ`. Build a durable economics research environment from the source registry in `docs/CANONICAL_PUBLIC_DATASETS.md`. Fetch representative active public sources first, normalize tables, preserve source URLs, write `source_registry.csv`, `source_registry.plan.json`, `manifest.json`, `data_dictionary.md`, `quality_report.md`, and a dataset briefing. Mark sources that need credentials, unclear licensing, or expensive access as deferred rather than failing the build.

### Sociology

Create or extend the public canonical dataset `sociology` named `Sociology`. Build a durable sociology research environment from public survey, demographic, institutions, health, crime, and social-attitudes sources in `docs/CANONICAL_PUBLIC_DATASETS.md`. Normalize survey metadata, codebooks, harmonized respondent tables where legally fetchable, and source provenance. Produce a manifest, data dictionary, quality report, source registry, and expansion plan.

### Philosophy

Create or extend the public canonical dataset `philosophy` named `Philosophy`. Build a durable philosophy research environment from public encyclopedia, bibliographic, archive, and public-domain text sources in `docs/CANONICAL_PUBLIC_DATASETS.md`. Normalize works, authors, concepts, citations, abstracts, and public-domain full text where allowed. Produce a manifest, data dictionary, quality report, source registry, and expansion plan.
