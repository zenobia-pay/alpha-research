# Econ Dataset Briefing

## Overview
- Canonical registry of 40 public economics, housing, credit, and macro-finance sources assembled on 2026-05-01 with stage `build` per `manifest.json`.
- Purpose is to standardize provenance, automation workflows, and QA guardrails for Alpha Research economic data assets, linking raw downloads to normalized tables and documentation.
- Current run (2026-05-04) validated processed panels for county permits, incomes, mortgage rates, and blended labor-housing indicators alongside registry metadata.

## Data Inventory
- Raw: BEA CAINC1 state/county income CSVs (1969–2024), Census BPS monthly county permit text dumps (2018–2026), BLS LAU employment area files, FRED mortgage rate CSV (1971–2026), Zillow county ZHVI monthly CSV, plus supporting BEA definitions and Census codebooks.
- Intermediate: `intermediate/county_month_coverage.csv` summarizing 3,042 county-month coverage ratios and `intermediate/qc_metrics.json` with completeness metrics.
- Processed Parquet/CSV: county annual income (`econ.bea_income_county_annual.parquet`), county monthly building permits (`econ.census_bps_county_monthly.parquet`), national mortgage rates (`econ.core_fred_mortgage_monthly.parquet`), fused county labor-housing annual indicators (`econ.lau_zhvi_county_annual.parquet` / CSV equivalent), and integrated county-month panel (`econ.panel_permits_income_mortgage_monthly.parquet`).
- Documentation: data dictionary, quality report, discovery narrative, and expansion plan clarifying governance decisions and future onboarding priorities.

## Sources
- Total sources: 40 (37 ready, 1 partial, 2 deferred); priorities span 10 highest, 15 high, 15 medium.
- Agencies represented include BLS, BEA, Census, HUD, FHFA, Treasury, Federal Reserve, USDA, EIA, CMS, SEC, IMF, OECD, BIS, and private portals such as Zillow and Redfin.
- Publication cadence counts: Monthly (10), Quarterly (6), Annual (4), mixed annual/quarterly (3), Weekly (2), with remaining sources covering daily or ad-hoc releases.
- Credential profile: 18 fully open, 11 requiring API keys, 5 optional credentials, plus four recommending keys for higher throughput; deferred sources (Case-Shiller, NAR) await licensing and Fannie Mae HPSI remains partial pending key issuance.

## Schemas
- `econ.bea_income_county_annual.parquet`: columns `county_fips`, `GeoName`, `year`, `personal_income_thousands`, `income_growth_yoy` (annual BEA CAINC personal income with YOY growth in percentage points).
- `econ.census_bps_county_monthly.parquet`: columns `county_fips`, `month` (YYYY-MM), `permits`, `permits_yoy` (monthly building permits counts and YOY deltas).
- `econ.core_fred_mortgage_monthly.parquet`: columns `month`, `mortgage_rate`, `mortgage_rate_change` (monthly average 30-year fixed mortgage and month-over-month change).
- `econ.lau_zhvi_county_annual.parquet` / `.csv`: columns `county_fips`, `state_abbr`, `county_label`, `year`, `unemployment_rate`, `unemployment_yoy`, `unemployment_change_since_2019`, `zhvi`, `zhvi_yoy`, `zhvi_growth_since_2019` (annual merge of BLS LAU unemployment and Zillow ZHVI housing values).
- `econ.panel_permits_income_mortgage_monthly.parquet`: columns `county_fips`, `month`, `permits`, `permits_yoy`, `mortgage_rate`, `mortgage_rate_change`, `income_growth_yoy` (county-month panel aligning permits with national mortgage rates and BEA income growth aligned to month).

## Time Coverage
- Registry metadata spans sources beginning as early as 1913-01-01 and extending to Present per `source_registry.csv`.
- Processed BEA income coverage 1969–2024 (annual), Census building permits 2018-01 through 2026-01 (monthly), FRED mortgage rates 1971-04 through 2026-04 (monthly), county labor-housing blend 2019–2024 (annual), and integrated panel 2018-01 through 2026-01.
- Intermediate QA covers 97 calendar months, with coverage ratios computed per county to quantify gaps.

## Geography Coverage
- County-level datasets cover up to 3,208 FIPS codes (BEA annual income) and 3,042 counties in monthly permit and panel tables; labor-housing blend reaches 2,998 counties.
- Registry geographies include United States national aggregates (23 sources), state-level coverage (6), county-level (7 with county detail, additional 4 labeled county), metro and ZIP-level datasets (each ~3), alongside global and international macro series (4 sources).
- HUD and LEHD crosswalk references support transformations between ZIP, tract, and county geographies for future onboarding.

## Formats
- Raw deliveries arrive as CSV, TXT, ZIP bundles, PDF codebooks, and XML definition files; processed outputs are primarily Parquet with mirrored CSV for the labor-housing blend.
- Metadata and plans are stored as Markdown (`*.md`), JSON (`source_registry.plan.json`, `qc_metrics.json`), and CSV registries.
- Artifacts align with ISO-8601 dating, FIPS/ISO geography keys, and units normalized to thousands-of-dollars or raw counts depending on source.

## Transformations & Derived Fields
- Year-over-year (`*_yoy`) growth metrics computed for personal income, building permits, Zillow ZHVI, and unemployment rate change relative to 2019 baselines for contextualizing pandemic recovery trajectories.
- Month-over-month `mortgage_rate_change` derived from FRED weekly series aggregated to monthly averages.
- County-month panel joins align BEA annual income growth to monthly cadence, blending national mortgage rates with local permits using consistent FIPS identifiers.
- QC intermediate tables aggregate coverage ratios to highlight counties lacking full temporal coverage prior to 2020.

## Quality & Validation
- Validation pipeline enforces freshness thresholds tied to each source’s expected lag, schema snapshots for (`time`, `geo_id`, `series`) keys, and outlier z-score checks (>4σ) with manual review for macro-critical series.
- Balance-sheet datasets require reconciliation within ±0.1%, and revision-prone sources (FRED, BEA, BLS) store release timestamps for reproducibility.
- Intermediate QC metrics show median county-month coverage ratio 0.51, minimum 0.02, maximum 1.00; missing income share 23.2%, mortgage coverage complete, supporting prioritization of backfill work.
- Licensing compliance monitored by deferring Case-Shiller and NAR feeds until agreements finalize, and documenting attribution requirements for Zillow and Redfin within the registry.

## Limitations & Known Gaps
- County income coverage remains incomplete for 23% of county-month combinations, particularly in early periods, affecting integrated panel completeness despite full mortgage coverage.
- One source (Fannie Mae HPSI) is only partially automated pending API approval; two high-value housing market sources (Case-Shiller, NAR Existing Home Sales) are deferred for licensing.
- Optional credential management for USDA, EIA, HUD, and BEA APIs needs centralized secret storage to prevent manual key rotation.
- Cross-source harmonization (e.g., Zillow vs. FHFA) and automated vintage diffing are planned but not yet implemented, limiting historical revision tracking.

## Local Documentation Sync
- This file is the canonical docs-side copy of the dataset briefing. The daily improvement automation must rewrite this file and `docs/public-datasets/econ.mdx` whenever it changes the mounted `dataset_briefing.md`.
