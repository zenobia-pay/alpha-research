You are running an admin-owned canonical improvement job for dataset `econ`.

Goal: add a public, bounded UN Comtrade API slice and reference tables to address the current roadmap gap "UN Comtrade" without requiring secrets or disturbing the existing economics substrate.

This is canonical dataset improvement work. Do not start `/api/cli/datasets/:datasetId/runs` and do not run `research --prompt`.

## Current source verification

Official UN Comtrade API host: `https://comtradeapi.un.org/`.

Live checks on 2026-06-01 verified public API access without a token:

- `https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=842&period=2024&cmdCode=TOTAL&flowCode=X&partnerCode=0`
  - GET returned HTTP 200 JSON with `count: 1`, `error: ""`, and a 2024 United States total export record with `primaryValue: 2063802611123`.
- `https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=842&period=2024&cmdCode=AG2&flowCode=M,X&partnerCode=0`
  - GET returned HTTP 200 JSON with `count: 194`, `error: ""`, covering HS 2-digit aggregate imports/exports for reporter 842 against world partner 0.
- `https://comtradeapi.un.org/files/v1/app/reference/Reporters.json`
  - GET returned HTTP 200 JSON, 80,812 bytes locally in verification, with 255 reporter entries from Afghanistan through Zimbabwe.
- `https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json`
  - GET returned HTTP 200 JSON in verification.

Full UN Comtrade bulk downloads and higher-volume API access may require an API token/subscription. Do not ask for secrets. Do not claim this is complete Comtrade coverage.

## Required dataset changes

1. Create `/data/datasets/econ/raw/un_comtrade_public_api_2024_hs2/`.
2. Download and preserve the following reference JSON files verbatim where available:
   - `Reporters.json` from `https://comtradeapi.un.org/files/v1/app/reference/Reporters.json`
   - `partnerAreas.json` from `https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json`
3. Query the public preview API for this bounded 2024 annual HS aggregate slice:
   - type `C`
   - frequency `A`
   - classification search code `HS`
   - period `2024`
   - partner `0` (World)
   - command `AG2` (HS 2-digit aggregate)
   - flows `M,X`
   - reporters: `32,36,76,124,156,251,276,360,381,392,410,484,643,682,710,792,826,842,699,757`
     - These cover Argentina, Australia, Brazil, Canada, China, France, Germany, Indonesia, Italy, Japan, Republic of Korea, Mexico, Russian Federation, Saudi Arabia, South Africa, Turkiye, United Kingdom, United States, India, and Switzerland where available in Comtrade reporter codes.
4. For each reporter, preserve the raw JSON response in `responses/reporter_<code>_2024_hs2_world_mx.json`.
5. Write a normalized CSV `comtrade_2024_hs2_world_mx.csv` by concatenating the `data` arrays. Preserve all JSON fields as columns, including reporter, flow, command, values, quantity fields, estimation flags, and aggregate flags.
6. Write `metadata.json` with:
   - source URL for each reference file and API query
   - HTTP status, response headers where available, byte counts, SHA-256 hashes
   - response `count`, `error`, and normalized row counts by reporter and flow
   - retrieval timestamp
   - a clear limitation note: this is a public API HS2 2024 world-partner slice, not full UN Comtrade bulk.
7. Update `/data/datasets/econ/dataset_briefing.md` and `/data/datasets/econ/docs/public-datasets/briefings/econ.md` by preserving the full existing briefing and adding one new bullet under `# Data Inventory`:
   - `raw/un_comtrade_public_api_2024_hs2/`: describe the reference files, raw API responses, normalized CSV, reporter list, row counts, fields, HTTP/hash evidence, and coverage.
   - State that this adds a UN Comtrade public API seed slice for major reporters but does not replace full Comtrade bulk, all reporters, all years, all partners, all HS/SITC/BEC classifications, monthly data, or token/subscription access.
8. Update the roadmap line so UN Comtrade is no longer described as entirely absent; it should say a public UN Comtrade 2024 HS2 major-reporter seed slice is present while full Comtrade coverage remains incomplete.

## Hard preservation requirements

Do not replace the full econ briefing with a short source-only briefing. Before finalizing, verify the full briefing still contains these existing inventory markers:

- `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
- `raw/worldbank/WDI_CSV_2026_04_09.zip`
- `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
- `raw/world_bank_wdi_20260409/`
- `raw/imf_weo_202604/`
- `raw/ilostat_core_labor_20260531/`
- `raw/wto_bulk_trade_20260422/`
- `raw/sec_edgar_bulk/`
- `raw/hmda_2024_snapshot/`
- `raw/un_comtrade_public_api_2024_hs2/`

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
  "added": ["raw/un_comtrade_public_api_2024_hs2/"],
  "evidence": [
    {
      "path": "raw/un_comtrade_public_api_2024_hs2/comtrade_2024_hs2_world_mx.csv",
      "sha256": "..."
    }
  ]
}
```

The `evidence` array must be non-empty and include the reference JSONs, raw response JSONs, normalized CSV, and metadata file. Do not use `Startup placeholder` or `startup_placeholder_not_final` anywhere in the final artifacts.

Also copy artifacts to `$RESULT_DIR` as required by the execution contract. Include `result.json` too if the local convention in this worker uses it.

## Final response

Report the UN Comtrade directory added, files, row counts, and validation evidence. Do not claim the econ dataset now has literally all data an economist could need; state that this is one more concrete gap narrowed and that full Comtrade remains incomplete without broader/tokened bulk coverage.
