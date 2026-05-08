# Overview
- Dataset `econ` aggregates publicly available U.S. macroeconomic and housing indicators captured on 2026-05-08 at 17:26:20Z.
- Scope currently covers FRED macroeconomic series and FHFA house price index; additional Census, BLS, BEA, Zillow, and NBER sources remain planned but not yet ingested.
- Collection emphasizes raw fidelity; no transformations or aggregations are applied beyond source-provided structures.

# Data Inventory
- `raw/fred/UNRATE.csv` — FRED unemployment rate monthly series (940 records, 2 columns, 14 KB, sha256 54b1cb60...d3d9af0).
- `raw/fred/GDP.csv` — FRED nominal GDP quarterly series (317 records, 2 columns, 6 KB, sha256 1a78eef4...19e9221).
- `raw/fhfa/hpi_at_state.csv` — FHFA all-transactions state house price index (10,404 records, 4 columns, 182 KB, sha256 00147d5...ff2e94).
- `raw/bls/cu.data.1.AllItems` — BLS CPI bulk file attempt (blocked; HTML access-denied response captured, 1.3 KB).
- Metadata assets: `manifest.json`, inventories (`download_*.{csv,jsonl}`, `raw_*.{csv,jsonl}`), `source_registry.*`, `data_dictionary.md`, `quality_report.md`, `volume_inventory*`, Slack alert mirrors.

# Sources
- **FRED** — Federal Reserve Economic Data; direct CSV endpoints for UNRATE and GDP retrieved successfully on 2026-05-08.
- **FHFA HPI** — Federal Housing Finance Agency, quarterly state all-transactions CSV retrieved successfully on 2026-05-08.
- **BLS CPI** — Bureau of Labor Statistics; attempted bulk text download blocked by HTTP 403 (Akamai), HTML denial retained.
- **Deferred/Planned** — Census portal, ACS, CPS, AHS, BLS LAUS, BEA, Zillow Research, NBER (status: not attempted or deferred pending licensing, access keys, or processing capacity).

# Schemas
- `UNRATE.csv`: columns `observation_date` (YYYY-MM-DD), `UNRATE` (percent, seasonally adjusted); primary key `observation_date`.
- `GDP.csv`: columns `observation_date` (YYYY-MM-DD at quarter start), `GDP` (billions of dollars, nominal); primary key `observation_date`.
- `hpi_at_state.csv`: columns `state` (two-letter code + DC), `year` (YYYY), `quarter` (1-4), `index_value` (index, not seasonally adjusted); composite primary key `state,year,quarter`.
- `cu.data.1.AllItems`: HTML error body, no usable schema.

# Time Coverage
- UNRATE: monthly observations from 1948-01-01 through 2026-04-01.
- GDP: quarterly observations from 1947-01-01 through 2026-01-01.
- FHFA HPI: quarterly observations from 1975Q1 through 2025Q4.
- BLS CPI download blocked; no time coverage available in this snapshot.

# Geography Coverage
- FRED UNRATE and GDP: United States national economic indicators.
- FHFA HPI: All 50 U.S. states plus District of Columbia.
- BLS CPI attempt: intended U.S. city average; unavailable due to access denial.

# Formats
- Accessible data stored as CSV files encoded in UTF-8 without BOM.
- Blocked BLS CPI attempt stored as HTML error response for auditing.
- Metadata delivered as Markdown (`.md`), CSV, JSON, and JSONL support files.

# Transformations & Derived Fields
- No transformations applied; files mirror source-provided layout.
- FHFA CSV lacks header row; column order documented in `raw_inventory` and briefing for downstream parsing.

# Quality & Validation
- `quality_report.md` (2026-05-08T17:26:20Z) logs one outstanding issue: BLS CPI automated fetch blocked (HTTP 403).
- Successful downloads verified via SHA-256 hashes recorded in inventories; byte sizes align with manifests.
- Slack alert artifacts generated but unsent pending webhook configuration; serve as audit trail.

# Limitations & Known Gaps
- BLS CPI bulk file inaccessible without interactive session; automation requires alternative endpoint or credentialed access.
- Major planned Census, BEA, Zillow, and NBER datasets remain absent, limiting coverage to three economic indicators.
- `.remote-agent/` runtime tooling present on volume; exclude from canonical dataset releases.
- FHFA schema depends on external layout documentation due to missing header row; downstream loaders must supply column names explicitly.
