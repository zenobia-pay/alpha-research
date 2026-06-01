You are running an admin-owned canonical improvement job for dataset `econ`.

Goal: add a compact ECB Data Portal / SDW public API slice to address the current roadmap gap "ECB SDW" without disturbing the existing economics substrate.

This is canonical dataset improvement work. Do not start `/api/cli/datasets/:datasetId/runs` and do not run `research --prompt`.

## Current source verification

Official ECB Data API host: `https://data-api.ecb.europa.eu/service/data/`.

Live checks on 2026-06-01 verified public CSV endpoints:

- `https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?startPeriod=2024-01-01&endPeriod=2026-05-31&format=csvdata`
  - HTTP 200; `content-type: text/csv`; `content-disposition: attachment;filename=data.csv`; `last-modified: Mon, 01 Jun 2026 13:57:39 GMT`.
  - CSV columns include `KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE,...,TITLE,TITLE_COMPL,UNIT,UNIT_MULT`.
- `https://data-api.ecb.europa.eu/service/data/EXR/D.GBP.EUR.SP00.A?startPeriod=2024-01-01&endPeriod=2026-05-31&format=csvdata`
  - HTTP 200; `content-type: text/csv`; `last-modified: Mon, 01 Jun 2026 13:57:39 GMT`.
- `https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y?startPeriod=2024-01-01&endPeriod=2026-05-31&format=csvdata`
  - HTTP 200; `content-type: text/csv`; `last-modified: Mon, 01 Jun 2026 10:00:00 GMT`.
  - CSV columns include `KEY,FREQ,REF_AREA,CURRENCY,PROVIDER_FM,INSTRUMENT_FM,...,TIME_PERIOD,OBS_VALUE,...,TITLE,TITLE_COMPL,UNIT,UNIT_MULT`.

## Required dataset changes

1. Create `/data/datasets/econ/raw/ecb_data_api_exr_yc_20260601/`.
2. Download and preserve provider CSV responses for these ECB Data API queries:
   - Daily euro foreign exchange reference rates, 2024-01-01 through 2026-05-31:
     - `EXR/D.USD.EUR.SP00.A`
     - `EXR/D.GBP.EUR.SP00.A`
     - `EXR/D.JPY.EUR.SP00.A`
     - `EXR/D.CHF.EUR.SP00.A`
     - `EXR/D.CNY.EUR.SP00.A`
     - `EXR/D.CAD.EUR.SP00.A`
   - Euro area AAA government bond nominal yield curve spot rates, business frequency, 2024-01-01 through 2026-05-31:
     - `YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_1Y`
     - `YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y`
     - `YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_5Y`
     - `YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y`
     - `YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_30Y`
3. Save each response as a descriptive CSV filename, for example:
   - `EXR_D_USD_EUR_SP00_A_20240101_20260531.csv`
   - `YC_B_U2_EUR_4F_G_N_A_SV_C_YM_SR_10Y_20240101_20260531.csv`
4. Write `metadata.json` in that directory with:
   - source URL for each file
   - HTTP status, response headers, actual byte count, SHA-256 hash
   - row and column counts, min/max `TIME_PERIOD`, `KEY`, and title/unit fields when present
   - retrieval timestamp
   - note that files are provider-native ECB Data API CSV responses
5. Optionally write an `inventory.csv` summary with one row per downloaded file.
6. Update `/data/datasets/econ/dataset_briefing.md` and `/data/datasets/econ/docs/public-datasets/briefings/econ.md` by preserving the full existing briefing and adding one new bullet under `# Data Inventory`:
   - `raw/ecb_data_api_exr_yc_20260601/`: describe the 11 CSV files, exact bytes/hashes, row counts, time coverage, exchange-rate currencies, yield-curve maturities, and ECB Data API provenance.
   - State that this adds an ECB Data Portal seed slice but does not replace full ECB SDW/Data Portal coverage across all dataflows, euro-area monetary statistics, supervisory datasets, payment statistics, securities statistics, bank balance sheets, or historical vintages.
7. Update the roadmap line so ECB is no longer described as entirely absent; it should say an ECB exchange-rate/yield-curve public API seed slice is present while broader ECB breadth remains incomplete.

## Hard preservation requirements

Do not replace the full econ briefing with a short source-only briefing. Before finalizing, verify the full briefing still contains these existing inventory markers:

- `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
- `raw/worldbank/WDI_CSV_2026_04_09.zip`
- `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
- `raw/world_bank_wdi_20260409/`
- `raw/imf_weo_202604/`
- `raw/ilostat_core_labor_20260531/`
- `raw/wto_bulk_trade_20260422/`
- `raw/un_comtrade_public_api_2024_hs2/`
- `raw/sec_edgar_bulk/`
- `raw/hmda_2024_snapshot/`
- `raw/ecb_data_api_exr_yc_20260601/`

If any marker is missing, repair the briefing from the checked-in full copy before finishing.

## Required artifacts

Write all of the following in `/data/datasets/econ/` and ensure they are non-empty:

- `dataset_briefing.md`
- `improvement_result.json`
- `work.md`
- `report.html`

`improvement_result.json` must be valid JSON and include:

```json
{
  "status": "completed",
  "datasetId": "econ",
  "added": ["raw/ecb_data_api_exr_yc_20260601/"],
  "evidence": [
    {
      "path": "raw/ecb_data_api_exr_yc_20260601/EXR_D_USD_EUR_SP00_A_20240101_20260531.csv",
      "sha256": "..."
    }
  ]
}
```

The `evidence` array must be non-empty and include every downloaded CSV plus `metadata.json` and `inventory.csv` if written. Do not use `Startup placeholder` or `startup_placeholder_not_final` anywhere in final artifacts.

Also copy artifacts to `$RESULT_DIR` as required by the execution contract. Include `result.json` too if the local convention in this worker uses it.

## Final response

Report the ECB directory added, files, row counts, and validation evidence. Do not claim the econ dataset now has literally all data an economist could need; state that this is one more concrete gap narrowed and that broader ECB SDW/Data Portal coverage remains incomplete.
