You are running an admin-owned canonical dataset improvement for `econ`.

Goal: add official U.S. Census Bureau Statistics of U.S. Businesses (SUSB) 2022 annual public datasets to the canonical econ dataset.

Why this matters:
- The current econ coverage roadmap explicitly lists firm, industry, and market-structure gaps including Census SUSB/older CBP vintages.
- Economists need firm and establishment counts, employment, payroll, receipts, industry, geography, and enterprise-size tabulations to study business dynamics, concentration, local labor demand, industry structure, and small business exposure.
- SUSB is an official Census annual series for U.S. businesses with paid employees.

Official sources verified by the operator on 2026-06-01:
- Landing page: `https://www.census.gov/data/datasets/2022/econ/susb/2022-susb.html`
  - Page title: `2022 SUSB Annual Datasets by Establishment Industry`
  - Publication date: April 2025.
  - Page says SUSB annual/static data include number of firms, number of establishments, employment, annual payroll, and receipts for most U.S. business establishments.
  - Page says data are tabulated by geographic area, industry, and enterprise employment or receipts size and use 2017 NAICS.
  - Page notes a July 22, 2025 revision for the 2022 MSA by 3-digit NAICS dataset.
  - Page says complete SUSB data files are provided in comma-delimited format and record layouts are available.
  - Page Last Revised: August 4, 2025.
- U.S. & states, 6-digit NAICS text file:
  - `https://www2.census.gov/programs-surveys/susb/tables/2022/us_state_6digitnaics_2022.txt`
  - HTTP 200
  - content-type: `text/plain`
  - content-length: `56000447`
  - last-modified: `Thu, 10 Apr 2025 13:17:09 GMT`
- U.S. & states, detailed employment sizes text file:
  - `https://www2.census.gov/programs-surveys/susb/tables/2022/us_state_naics_detailedsizes_2022.txt`
  - HTTP 200
  - content-type: `text/plain`
  - content-length: `6995555`
  - last-modified: `Thu, 10 Apr 2025 13:16:08 GMT`
- MSA, 3-digit NAICS revised text file:
  - `https://www2.census.gov/programs-surveys/susb/datasets/2022/msa_3digitnaics_2022.txt`
  - HTTP 200
  - content-type: `text/plain`
  - content-length: `48041887`
  - last-modified: `Tue, 22 Jul 2025 19:15:26 GMT`
- Record layouts page:
  - `https://www.census.gov/programs-surveys/susb/technical-documentation/record-layouts.html`
  - HTTP 200
  - content-type: `text/html; charset=UTF-8`

Required behavior:
1. Perform the standard real create/delete write probe inside the `econ` dataset root before any dataset mutation.
2. Verify the official Census landing page, record-layout page, and exact data URLs above from Census-hosted domains. Do not use mirrors.
3. Download and preserve provider-native files under `raw/census_susb_2022/`:
   - `us_state_6digitnaics_2022.txt`
   - `us_state_naics_detailedsizes_2022.txt`
   - `msa_3digitnaics_2022.txt`
   - `record_layouts_snapshot.html` or compact metadata proving the record-layout page was checked.
   - a metadata JSON file recording source URLs, retrieval time, HTTP headers where available, byte sizes, SHA-256 hashes, row counts, field counts, detected delimiters/headers, and coverage notes.
4. Inspect each text file without creating many derived files. Record row count, field count, header fields, min/max geography/reporting markers where practical, and a concise measure summary.
5. Record inventory metadata for each stored file: path, source URL, byte size, SHA-256, last-modified if available, row count, field count, and concise content summary.
6. Document coverage precisely:
   - 2022 SUSB annual establishment-industry datasets.
   - U.S. and state 6-digit NAICS firm/establishment/employment/payroll/receipts data.
   - U.S. and state detailed enterprise employment-size data.
   - Revised MSA 3-digit NAICS data.
   - Measures include firms, establishments, employment during the March 12 reference week, annual payroll, and receipts where present, tabulated by geography, NAICS, and enterprise size categories.
   - This materially improves firm, industry, local labor demand, business-size, and market-structure coverage, but it does not replace ABS/ASE owner-demographic data, full historical SUSB/CBP vintages, business microdata, LBD, BED history, proprietary firm databases, or licensed establishment-level data.
7. Update the mounted dataset briefing, docs mirrors, manifest/profile/quality metadata, and produced artifacts so this execution becomes the current disk inventory proof.
8. Keep the language honest: this improves firm/industry coverage; the econ dataset is still not complete for every economist need.

Success evidence required:
- Admin execution id and status URL.
- Evidence that the Census landing page, record-layout page, and data files were verified.
- Paths written under `raw/census_susb_2022/`.
- Row counts, field counts, hashes, byte sizes, and last-modified evidence.
- Updated briefing/profile artifacts.
- Final status must be suitable for local validation with `npm run canonical:dataset -- validate --dataset-id econ --execution-id <execution-id>`.
