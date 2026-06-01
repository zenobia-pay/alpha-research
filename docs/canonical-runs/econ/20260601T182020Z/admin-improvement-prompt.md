# Econ Canonical Admin Improvement: BLS QCEW Annual and Quarterly Slice

You are running an admin-owned canonical dataset-improvement job for dataset `econ`.

This is not a user-facing research analysis run. Do not call `/api/cli/datasets/:datasetId/runs`, do not run `research --prompt`, and do not create merged panels, derived columns, model-ready datasets, or cross-source joins.

## Dataset Root

Use the mounted canonical dataset root:

- Prefer `DATASET_MOUNT_PATH` when set.
- Otherwise use `/data/datasets/econ`.

Before downloads, prove the dataset root is mounted and writable with an actual create/delete probe in the dataset root. If the write probe fails, stop and report the exact non-secret filesystem error.

## Objective

Add a provider-native Bureau of Labor Statistics Quarterly Census of Employment and Wages (QCEW) public slice to reduce the roadmap gap for BLS BED/QCEW history and strengthen county/industry employment, wage, and establishment coverage.

Create this directory:

`raw/bls_qcew_2024_annual_2025_quarterly/`

Download and preserve these official BLS QCEW ZIP files exactly as returned by the provider:

1. `2025_qtrly_singlefile.zip`
   - URL: `https://data.bls.gov/cew/data/files/2025/csv/2025_qtrly_singlefile.zip`
   - Verified before launch: HTTP 200, `Content-Length: 226777506`, `Content-Type: application/zip`, `Last-Modified: Wed, 04 Mar 2026 12:11:48 GMT`
2. `2024_annual_singlefile.zip`
   - URL: `https://data.bls.gov/cew/data/files/2024/csv/2024_annual_singlefile.zip`
   - Verified before launch: HTTP 200, `Content-Length: 74697761`, `Content-Type: application/zip`, `Last-Modified: Tue, 02 Sep 2025 11:20:46 GMT`

The 2025 annual singlefile endpoint was checked before launch and returned HTTP 404 on 2026-06-01, so use 2024 as the latest complete annual file and 2025 as the latest quarterly file.

## Required Local Evidence

For each ZIP:

- Store the provider-native ZIP without expanding it into many files.
- Capture request URL, final URL if redirected, status, response headers, byte count, SHA-256 hash, ZIP integrity check, member list with compressed/uncompressed sizes, row count and column count for the contained CSV member(s), first header line, and a short source-topic note.
- Use streaming or ZIP member reads for row counts. Do not extract full CSVs to disk unless needed for inspection.

Write:

- `raw/bls_qcew_2024_annual_2025_quarterly/metadata.json`
- `raw/bls_qcew_2024_annual_2025_quarterly/inventory.csv`

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
- `raw/sec_edgar_bulk/`
- `raw/hmda_2024_snapshot/`

Add a new bullet for `raw/bls_qcew_2024_annual_2025_quarterly/` that states exactly what was downloaded, byte totals, hashes, member/row/column coverage, frequency/year coverage, and remaining caveats.

Update the firm/industry/labor roadmap caveat to say that QCEW 2024 annual and 2025 quarterly public singlefile ZIPs are now present, while BLS BED, deeper historical QCEW vintages, restricted LBD/BED microdata, and licensed establishment-level data remain incomplete.

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
