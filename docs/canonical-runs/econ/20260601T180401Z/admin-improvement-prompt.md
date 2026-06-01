# Econ Canonical Admin Improvement: Eurostat Macro, Labor, Public Finance Slice

You are running an admin-owned canonical dataset-improvement job for dataset `econ`.

This is not a user-facing research analysis run. Do not call `/api/cli/datasets/:datasetId/runs`, do not run `research --prompt`, and do not create merged panels, derived columns, model-ready datasets, or cross-source joins.

## Dataset Root

Use the mounted canonical dataset root:

- Prefer `DATASET_MOUNT_PATH` when set.
- Otherwise use `/data/datasets/econ`.

Before downloads, prove the dataset root is mounted and writable with an actual create/delete probe in the dataset root. If the write probe fails, stop and report the exact non-secret filesystem error.

## Objective

Add a compact provider-native Eurostat public macro/labor/public-finance slice that reduces the current roadmap gap for broader Eurostat dataflows beyond the existing HICP file.

Create this directory:

`raw/eurostat_macro_labor_public_finance_20260601/`

Download and preserve the following official Eurostat dissemination API compressed TSV files exactly as returned by the provider:

1. `nama_10_gdp`
   - URL: `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/nama_10_gdp?format=TSV&compressed=true`
   - Expected response filename: `estat_nama_10_gdp.tsv.gz`
   - Verified before launch: HTTP 200, `Content-Length: 3524409`, `Content-Type: text/tab-separated-values`
2. `nama_10_pc`
   - URL: `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/nama_10_pc?format=TSV&compressed=true`
   - Expected response filename: `estat_nama_10_pc.tsv.gz`
   - Verified before launch: HTTP 200, `Content-Length: 363306`, `Content-Type: text/tab-separated-values`
3. `lfsa_egan`
   - URL: `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/lfsa_egan?format=TSV&compressed=true`
   - Expected response filename: `estat_lfsa_egan.tsv.gz`
   - Verified before launch: HTTP 200, `Content-Length: 1222204`, `Content-Type: text/tab-separated-values`
4. `gov_10dd_edpt1`
   - URL: `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/gov_10dd_edpt1?format=TSV&compressed=true`
   - Expected response filename: `estat_gov_10dd_edpt1.tsv.gz`
   - Verified before launch: HTTP 200, `Content-Length: 151701`, `Content-Type: text/tab-separated-values`
5. `une_rt_a`
   - URL: `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/une_rt_a?format=TSV&compressed=true`
   - Expected response filename: `estat_une_rt_a.tsv.gz`
   - Verified before launch: HTTP 200, `Content-Length: 72694`, `Content-Type: text/tab-separated-values`
6. `demo_pjan`
   - URL: `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/demo_pjan?format=TSV&compressed=true`
   - Expected response filename: `estat_demo_pjan.tsv.gz`
   - Verified before launch: HTTP 200, `Content-Length: 2309949`, `Content-Type: text/tab-separated-values`

## Required Local Evidence

For each file:

- Store the provider-native `.tsv.gz` payload without expanding it into many small files.
- Capture request URL, final URL if redirected, status, response headers, byte count, SHA-256 hash, gzip integrity check, first header line after streaming decompression, column count, data-row count, available time-period column range, and a short source-topic note.
- Avoid creating many tiny extracted files. Streaming inspection is fine.

Write:

- `raw/eurostat_macro_labor_public_finance_20260601/metadata.json`
- `raw/eurostat_macro_labor_public_finance_20260601/inventory.csv`

## Briefing Update Contract

Update the dataset briefing and docs mirror as a literal inventory of what is now on disk.

Preserve the existing full econ inventory. Do not shorten, reorder destructively, or drop existing bullets such as:

- `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
- `raw/worldbank/WDI_CSV_2026_04_09.zip`
- `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
- `raw/world_bank_wdi_20260409/`
- `raw/imf_weo_202604/`
- `raw/ilostat_core_labor_20260531/`
- `raw/wto_bulk_trade_20260422/`
- `raw/un_comtrade_public_api_2024_hs2/`
- `raw/ecb_data_api_exr_yc_20260601/`
- `raw/sec_edgar_bulk/`
- `raw/hmda_2024_snapshot/`

Add a new bullet for `raw/eurostat_macro_labor_public_finance_20260601/` that states exactly what was downloaded, how large it is, row/column/time coverage per file, and remaining caveats.

Update the roadmap caveat for broader Eurostat/ECB dataflows to say that Eurostat HICP plus this macro/labor/public-finance slice and the ECB EXR/YC seed are present, but broader Eurostat domains and broader ECB SDW/Data Portal dataflows remain incomplete.

Do not claim the econ dataset now has all data an economist could need.

## Required Artifacts and Profile Proof

Produce the standard improvement artifacts:

- `dataset_briefing.md`
- `improvement_result.json`
- `work.md`
- `report.html`

Synchronize the CLI-visible dataset profile so `briefingMarkdown` contains the full updated briefing and `profile.quality.volumeInventoryRunId` equals this execution id. Read it back and include proof in `improvement_result.json`.

If any required artifact, profile sync, or readback proof is missing, mark `diskInventoryProven: false` and report the exact non-secret blocker.
