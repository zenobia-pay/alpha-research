You are running an admin-owned canonical improvement job for dataset `econ`.

Goal: add provider-native WTO public bulk trade datasets to address the current roadmap gap "WTO" without disturbing the existing economics substrate.

This is canonical dataset improvement work. Do not start `/api/cli/datasets/:datasetId/runs` and do not run `research --prompt`.

## Current source verification

Official WTO bulk catalog: `https://data.wto.org/dataset/bulkdownload`.

The catalog states that the bulk download page is a central gateway to WTO trade data and organizes access to:

- Merchandise trade values annual dataset
- Merchandise trade indices annual dataset
- Trade in services annual dataset
- WTO-OECD Balanced Trade in Services dataset (BaTIS) BPM6
- WTO-OECD Balanced Trade in Services dataset (BaTIS) BPM5
- Trade in Services data by mode of supply (TISMOS)

Live endpoint checks on 2026-06-01 verified these ZIP resources:

- `https://stats.wto.org/assets/UserGuide/merchandise_values_annual_dataset.zip`
  - HTTP 200; content-type `application/x-zip-compressed`; content-length `2111787`; last-modified `Wed, 22 Apr 2026 19:56:48 GMT`; etag `"d14bbe2792d2dc1:0"`.
- `https://stats.wto.org/assets/UserGuide/merchandise_indices_annual_dataset.zip`
  - HTTP 200; content-type `application/x-zip-compressed`; content-length `825009`; last-modified `Wed, 22 Apr 2026 20:00:20 GMT`; etag `"6213f0a592d2dc1:0"`.
- `https://stats.wto.org/assets/UserGuide/services_annual_dataset.zip`
  - HTTP 200; content-type `application/x-zip-compressed`; content-length `78565733`; last-modified `Wed, 22 Apr 2026 19:59:32 GMT`; etag `"e517678992d2dc1:0"`.
- `https://www.wto.org/english/res_e/statis_e/daily_update_e/OECD-WTO_BATIS_data.zip`
  - HTTP 200; content-type `application/x-zip-compressed`; content-length `104034363`; last-modified `Fri, 01 Dec 2017 09:04:05 GMT`; etag `"48ca9b56836ad31:0"`.
- `https://www.wto.org/english/res_e/statis_e/daily_update_e/Tismos_imports.zip`
  - HTTP 200; content-type `application/x-zip-compressed`; content-length `3141818`; last-modified `Tue, 30 Jul 2019 10:19:00 GMT`; etag `"994a234c046d51:0"`.
- `https://www.wto.org/english/res_e/statis_e/daily_update_e/Tismos_exports.zip`
  - HTTP 200; content-type `application/x-zip-compressed`; content-length `2230812`; last-modified `Tue, 30 Jul 2019 10:19:02 GMT`; etag `"67696635c046d51:0"`.

The catalog also links `https://www.wto.org/english/res_e/statis_e/daily_update_e/OECD-WTO_BATIS_data_BPM6.zip`, but live verification on 2026-06-01 returned HTTP 302 to `http://www.wto.org/error/error_404.htm`. Do not treat that file as ingested unless a fresh check returns a real ZIP.

## Required dataset changes

1. Create `/data/datasets/econ/raw/wto_bulk_trade_20260422/`.
2. Download and preserve these six provider ZIP files verbatim:
   - `merchandise_values_annual_dataset.zip`
   - `merchandise_indices_annual_dataset.zip`
   - `services_annual_dataset.zip`
   - `OECD-WTO_BATIS_data.zip`
   - `Tismos_imports.zip`
   - `Tismos_exports.zip`
3. Write `metadata.json` in that directory with:
   - source URL for each file
   - HTTP status, response headers available from HEAD/GET, content length or actual byte count
   - SHA-256 hash
   - retrieval timestamp
   - ZIP integrity result and member inventory
   - streamed row/column counts for CSV-like members where practical without fully expanding huge archives into many files
   - note that the BPM6 BaTIS link was checked but unavailable via 302-to-404 on 2026-06-01 if it remains unavailable
4. Update `/data/datasets/econ/dataset_briefing.md` and `/data/datasets/econ/docs/public-datasets/briefings/econ.md` by preserving the full existing briefing and adding one new bullet under `# Data Inventory`:
   - `raw/wto_bulk_trade_20260422/`: describe the six WTO ZIP files, exact bytes, SHA-256 hashes, ZIP/member evidence, and coverage: merchandise trade values, merchandise trade indices, trade in services annual data, BaTIS BPM5 balanced services trade, and TISMOS import/export mode-of-supply services data.
   - Make clear this improves but does not complete WTO coverage; remaining gaps include the unavailable BPM6 BaTIS bulk file if still unavailable, API/account-gated WTO Stats extraction, deeper tariff/non-tariff/market-access tables, and UN Comtrade.
5. Update the roadmap line so WTO is no longer described as entirely absent; it should say a WTO public bulk trade slice is present while broader WTO and trade coverage remain incomplete.

## Hard preservation requirements

Do not replace the full econ briefing with a short source-only briefing. Before finalizing, verify the full briefing still contains these existing inventory markers:

- `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
- `raw/worldbank/WDI_CSV_2026_04_09.zip`
- `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
- `raw/world_bank_wdi_20260409/`
- `raw/imf_weo_202604/`
- `raw/ilostat_core_labor_20260531/`
- `raw/sec_edgar_bulk/`
- `raw/hmda_2024_snapshot/`
- `raw/wto_bulk_trade_20260422/`

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
  "added": ["raw/wto_bulk_trade_20260422/"],
  "evidence": [
    {
      "path": "raw/wto_bulk_trade_20260422/merchandise_values_annual_dataset.zip",
      "sha256": "..."
    }
  ]
}
```

The `evidence` array must be non-empty and include every downloaded provider file. Do not use `Startup placeholder` or `startup_placeholder_not_final` anywhere in the final artifacts.

Also copy artifacts to `$RESULT_DIR` as required by the execution contract. Include `result.json` too if the local convention in this worker uses it.

## Final response

Report the WTO directory added, downloaded files, byte counts, and validation evidence. Do not claim the econ dataset now has literally all data an economist could need; state that this is one more concrete gap closed.
