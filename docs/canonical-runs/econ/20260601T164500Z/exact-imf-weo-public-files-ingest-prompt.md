Canonical dataset maintenance for dataset id `econ`: ingest public IMF WEO April 2026 source files.

Task type: public data file ingestion and inventory. Do not perform policy analysis or generate recommendations.

Create or update `raw/imf_weo_202604/` with these public IMF files:
- `WEOApr2026all.xlsx`: `https://data.imf.org/-/media/iData/External-Storage/Documents/2F78EE59F79143A7921E5E203D3AAA80/en/WEOApr2026all.xlsx`
- `WEOhistorical.xlsx`: `https://data.imf.org/-/media/iData/External-Storage/Documents/977574FA66914EAD900D3FEC55C7316A/en/WEOhistorical.xlsx`
- `April-2026-WEO-Database-Appendix.pdf`: `https://data.imf.org/-/media/iData/External-Storage/Documents/4AA1F4D0624C46E98F95988F1F83E770/en/April-2026-WEO-Database-Appendix.pdf`
- `WEO-Database-Transition-Guide.pdf`: `https://data.imf.org/-/media/iData/External-Storage/Documents/2C2B2F3E671A4B11ABE756E2441FD6F0/en/WEO-Database-Transition-Guide.pdf`

Local HEAD checks on 2026-06-01 confirmed:
- `WEOApr2026all.xlsx`: HTTP 200; content type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; content disposition `attachment; filename="WEOApr2026all.xlsx"`.
- `WEOhistorical.xlsx`: HTTP 200; content type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; content disposition `attachment; filename="WEOhistorical.xlsx"`.
- `April-2026-WEO-Database-Appendix.pdf`: HTTP 200; content type `application/pdf`; content length `523673`; content disposition `attachment; filename="April 2026 WEO Database Appendix.pdf"`.

Required steps:
1. Create/delete probe in the dataset root.
2. Download the four files above, preserving provider filenames or normalized equivalents under `raw/imf_weo_202604/`.
3. For each file, record URL, HTTP status, content type, content disposition, byte count, SHA256, and any last-modified/etag header.
4. Verify XLSX files as ZIP containers. Verify PDFs with `%PDF` header.
5. Inventory workbook sheet names, dimensions, row counts, and column counts without extracting worksheets as raw files.
6. Write `raw/imf_weo_202604/metadata.json`.
7. Update download/raw/volume inventory files, manifest/source registry/provenance files, and `raw_files.json` for this source.

Full briefing preservation:
- Preserve the existing full econ briefing. Do not replace it with a short IMF-only briefing.
- `dataset_briefing.md`, `docs/public-datasets/briefings/econ.md`, and `docs/public-datasets/econ.mdx` must retain these markers:
  - `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
  - `raw/worldbank/WDI_CSV_2026_04_09.zip`
  - `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
  - `raw/world_bank_wdi_20260409/`
- Add a `raw/imf_weo_202604/` bullet describing the WEO April 2026 workbook, historical workbook, appendix PDF, transition guide PDF, workbook sheets/rows/columns, and remaining gaps.
- Update roadmap language so IMF WEO is present, while IMF datasets beyond WEO, UN Comtrade, WTO, ILOSTAT, broader Eurostat/ECB, restricted microdata, and licensed/proprietary data remain incomplete.

Required artifacts:
- `dataset_briefing.md`
- `improvement_result.json`
- `work.md`
- `report.html`
- `result.json`

Before final response, promote artifacts:

```bash
RESULT_DIR=${RESULT_DIR:-/results/$RUN_ID}
mkdir -p "$RESULT_DIR/.remote-agent/state" "$RESULT_DIR/docs/public-datasets/briefings"
cp "$DATASET_DIR/dataset_briefing.md" "$RESULT_DIR/dataset_briefing.md"
cp "$DATASET_DIR/improvement_result.json" "$RESULT_DIR/improvement_result.json"
cp "$DATASET_DIR/work.md" "$RESULT_DIR/work.md"
cp "$DATASET_DIR/report.html" "$RESULT_DIR/report.html"
cp "$DATASET_DIR/result.json" "$RESULT_DIR/result.json"
cp "$DATASET_DIR/docs/public-datasets/briefings/econ.md" "$RESULT_DIR/docs/public-datasets/briefings/econ.md" 2>/dev/null || true
cp "$DATASET_DIR/docs/public-datasets/econ.mdx" "$RESULT_DIR/docs/public-datasets/econ.mdx" 2>/dev/null || true
test -s "$RESULT_DIR/dataset_briefing.md"
test -s "$RESULT_DIR/improvement_result.json"
test -s "$RESULT_DIR/work.md"
test -s "$RESULT_DIR/report.html"
test -s "$RESULT_DIR/result.json"
grep -q 'raw/federal_reserve_z1/z1_csv_files_20260319.zip' "$RESULT_DIR/dataset_briefing.md"
grep -q 'raw/worldbank/WDI_CSV_2026_04_09.zip' "$RESULT_DIR/dataset_briefing.md"
grep -q 'raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip' "$RESULT_DIR/dataset_briefing.md"
grep -q 'raw/world_bank_wdi_20260409/' "$RESULT_DIR/dataset_briefing.md"
grep -q 'raw/imf_weo_202604/' "$RESULT_DIR/dataset_briefing.md"
ls -la "$RESULT_DIR"
```

Return a concise ingest summary: files downloaded, byte counts, hashes, workbook sheet dimensions, and artifact promotion status.
