# Econ Canonical Admin Improvement: CFTC Disaggregated Futures History 2020-2025

You are running an admin-owned canonical dataset-improvement job for dataset `econ`.

This is not a user-facing research analysis run. Do not call `/api/cli/datasets/:datasetId/runs`, do not run `research --prompt`, and do not create merged panels, derived columns, model-ready datasets, or cross-source joins.

## Dataset Root

Use the mounted canonical dataset root:

- Prefer `DATASET_MOUNT_PATH` when set.
- Otherwise use `/data/datasets/econ`.

Before downloads, prove the dataset root is mounted and writable with an actual create/delete probe in the dataset root. If the write probe fails, stop and report the exact non-secret filesystem error.

## Objective

Add provider-native Commodity Futures Trading Commission Commitments of Traders disaggregated futures-only history for recent full years. The current econ dataset has a 2026 YTD disaggregated futures file; this run should add 2020-2025 full-year ZIP archives to reduce the roadmap gap for broader CFTC market-position history.

Create this directory:

`raw/cftc_cot_disaggregated_history_2020_2025/`

Download and preserve these official CFTC ZIP files exactly as returned by the provider:

- `fut_disagg_txt_2025.zip`: `https://www.cftc.gov/files/dea/history/fut_disagg_txt_2025.zip` (verified HTTP 200, `Content-Length: 2420076`, `Content-Type: application/zip`, `Last-Modified: Fri, 29 May 2026 19:27:52 GMT`)
- `fut_disagg_txt_2024.zip`: `https://www.cftc.gov/files/dea/history/fut_disagg_txt_2024.zip` (verified HTTP 200, `Content-Length: 2381296`, `Content-Type: application/zip`, `Last-Modified: Thu, 15 Jan 2026 17:02:19 GMT`)
- `fut_disagg_txt_2023.zip`: `https://www.cftc.gov/files/dea/history/fut_disagg_txt_2023.zip` (verified HTTP 200, `Content-Length: 2202972`, `Content-Type: application/zip`, `Last-Modified: Thu, 15 Jan 2026 17:02:19 GMT`)
- `fut_disagg_txt_2022.zip`: `https://www.cftc.gov/files/dea/history/fut_disagg_txt_2022.zip` (verified HTTP 200, `Content-Length: 2049193`, `Content-Type: application/zip`, `Last-Modified: Thu, 15 Jan 2026 17:02:19 GMT`)
- `fut_disagg_txt_2021.zip`: `https://www.cftc.gov/files/dea/history/fut_disagg_txt_2021.zip` (verified HTTP 200, `Content-Length: 1943806`, `Content-Type: application/zip`, `Last-Modified: Fri, 14 Jan 2022 20:27:10 GMT`)
- `fut_disagg_txt_2020.zip`: `https://www.cftc.gov/files/dea/history/fut_disagg_txt_2020.zip` (verified HTTP 200, `Content-Length: 1930322`, `Content-Type: application/zip`, `Last-Modified: Fri, 29 Oct 2021 19:28:13 GMT`)

## Required Local Evidence

For each ZIP:

- Store the provider-native ZIP without expanding it into many files.
- Capture request URL, final URL if redirected, status, response headers, byte count, SHA-256 hash, ZIP integrity check, member list with compressed/uncompressed sizes, row count and column count for the contained TXT member(s), first header line, and a short source-topic note.
- Use streaming or ZIP member reads for row counts. Do not extract full TXT files to disk unless needed for inspection.

Write:

- `raw/cftc_cot_disaggregated_history_2020_2025/metadata.json`
- `raw/cftc_cot_disaggregated_history_2020_2025/inventory.csv`

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
- `raw/eurostat_macro_labor_public_finance_20260601/`
- `raw/bls_qcew_2024_annual_2025_quarterly/`
- `raw/sec_edgar_bulk/`
- `raw/hmda_2024_snapshot/`

Add a new bullet for `raw/cftc_cot_disaggregated_history_2020_2025/` that states exactly what was downloaded, byte totals, hashes, member/row/column coverage, year coverage, and remaining caveats.

Update the credit/banking/financial-markets roadmap caveat to say that CFTC disaggregated futures-only history for 2020-2026 YTD is now present in part, while broader CFTC report families, older history, futures-and-options variants, and licensed market reference/tick data remain incomplete.

Do not claim the econ dataset now has all data an economist could need.

## Required Artifacts and Profile Proof

Produce the standard improvement artifacts:

- `dataset_briefing.md`
- `improvement_result.json`
- `work.md`
- `report.html`

Synchronize the CLI-visible dataset profile so `briefingMarkdown` contains the full updated briefing and `profile.quality.volumeInventoryRunId` equals this execution id. Read it back and include proof in `improvement_result.json`.

If any required artifact, profile sync, or readback proof is missing, mark `diskInventoryProven: false` and report the exact non-secret blocker.

## Non-Optional Artifact Promotion Contract

Before the final response, copy the primary artifacts into the exact remote result directory so the orchestrator can collect them:

```bash
RESULT_DIR=${RESULT_DIR:-/results/$RUN_ID}
mkdir -p "$RESULT_DIR/docs/public-datasets/briefings"
DOCS_BRIEFING="$DATASET_DIR/docs/public-datasets/briefings/econ.md"
if [ -f "$DOCS_BRIEFING" ]; then
  DOCS_BYTES=$(wc -c < "$DOCS_BRIEFING")
  DATASET_BYTES=0
  [ -f "$DATASET_DIR/dataset_briefing.md" ] && DATASET_BYTES=$(wc -c < "$DATASET_DIR/dataset_briefing.md")
  if [ "$DOCS_BYTES" -gt "$DATASET_BYTES" ]; then
    cp "$DOCS_BRIEFING" "$DATASET_DIR/dataset_briefing.md"
  fi
fi
cp "$DATASET_DIR/dataset_briefing.md" "$RESULT_DIR/dataset_briefing.md"
cp "$DATASET_DIR/improvement_result.json" "$RESULT_DIR/improvement_result.json"
cp "$DATASET_DIR/work.md" "$RESULT_DIR/work.md"
cp "$DATASET_DIR/report.html" "$RESULT_DIR/report.html"
cp "$DATASET_DIR/docs/public-datasets/briefings/econ.md" "$RESULT_DIR/docs/public-datasets/briefings/econ.md" 2>/dev/null || true
cp "$DATASET_DIR/docs/public-datasets/econ.mdx" "$RESULT_DIR/docs/public-datasets/econ.mdx" 2>/dev/null || true
```

If `$RUN_ID` or `$RESULT_DIR` is unavailable, discover the result directory under `/results` and copy the same files there. Do not finish until `ls -l "$RESULT_DIR"` shows `dataset_briefing.md`, `improvement_result.json`, `work.md`, and `report.html`.
