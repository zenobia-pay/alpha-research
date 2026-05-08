# Overview
- Dataset `econ` is a raw public-source economics package expanded by remote run `d30a3eaf-730c-4666-84f4-98a6d35c9dd6` on 2026-05-08.
- The mounted volume inventory was regenerated at 2026-05-08T19:53:39.056711Z: 23,837 files totaling 8,542,014,365 bytes.
- Canonical policy remains raw provider-native files only; no merged panels, derived fields, or analysis-ready outputs are canonical artifacts.

# Data Inventory
## Accessible raw source packages
- `raw/fred/CPIAUCSL.csv`, `raw/fred/FEDFUNDS.csv`, `raw/fred/DGS10.csv`, `raw/fred/UNRATE.csv`, `raw/fred/GDP.csv` — FRED macro series for CPI, federal funds rate, 10-year Treasury yield, unemployment, and GDP.
- `raw/census/acs/csv_pus.zip` — Census ACS 2024 1-year PUMS public-use microdata for the United States.
- `raw/census/cps/jan26pub.zip` — Census CPS Basic Monthly January 2026 public-use file.
- `raw/census/ahs/AHS_2023_National_PUF_v1.1_CSV.zip` — Census American Housing Survey 2023 national public-use file.
- `raw/fhfa/hpi_at_state.csv` and `raw/fhfa/hpi_at_metro.csv` — FHFA all-transactions house price index files for state and metro geographies.
- `raw/bea/CAINC1.zip` — BEA regional/state personal income tables.

## Downloaded with license review caveats
- `raw/bis/WS_LBS_D_PUB_csv_col.zip` — BIS locational banking statistics bulk ZIP; review redistribution terms before publishing outside the canonical volume.
- `raw/oecd/MEI_CLI_USA.json` — OECD Main Economic Indicators composite leading indicator JSON for the United States; review terms.
- `raw/zillow/City_zhvi_uc_sfr_tier_0.33_0.67_sm_sa_month.csv` — Zillow city-level ZHVI single-family time series; review Zillow redistribution terms.
- `raw/nber/cyclesmain.html` — NBER business-cycle chronology HTML page; review reuse terms.

## Blocked or deferred attempts
- BLS CPI, LAUS, ATUS, and CEX endpoints returned HTTP 403, DNS failure, or other access blocks from the remote runner.
- HUD CHAS and FY2026 Small Area FMR downloads were blocked by AWS WAF challenge pages.
- Treasury daily yield curve CSV path returned HTTP 404; use FRED mirror or confirm the current Treasury data API path.
- Redfin market trends CSV returned AWS S3 AccessDenied.
- IMF SDMX host failed DNS resolution from the runner.
- Census Building Permits Survey CBSA file returned HTTP 404.

# Coverage
- Macroeconomics: CPI, federal funds rate, Treasury yield, unemployment, GDP, OECD CLI, BEA income.
- Housing: FHFA state/metro HPI, Zillow city ZHVI, AHS microdata.
- Household/labor microdata: ACS PUMS and CPS Basic.
- Global/finance: BIS locational banking statistics and OECD leading indicators.

# Quality And Proof
- `download_inventory.*`, `download_events.jsonl`, `raw_inventory.*`, `volume_inventory.*`, `quality_report.md`, `dataset_briefing.md`, and docs mirrors were regenerated on the mounted volume by run `d30a3eaf-730c-4666-84f4-98a6d35c9dd6`.
- Remote run summary reports Slack alerts delivered for every terminal attempt.
- `diskInventoryProven` is true for run `d30a3eaf-730c-4666-84f4-98a6d35c9dd6` with volume inventory timestamp 2026-05-08T19:53:39.056711Z.

# Limitations
- Several high-value sources remain blocked by provider access controls: BLS, HUD, Redfin, IMF, Treasury, and Census BPS.
- License-review sources must not be redistributed externally until terms are reviewed.
- Runtime tooling under `.remote-agent/` remains non-dataset contamination and should be excluded from published packages.
