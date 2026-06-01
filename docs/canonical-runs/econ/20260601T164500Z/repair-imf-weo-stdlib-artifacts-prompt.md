Repair and complete the `econ` IMF WEO April 2026 public-file ingest using only standard-library workbook inspection.

This is dataset maintenance for dataset id `econ`. Keep it to file verification, inventory, docs, and artifact promotion.

Prior execution `4a0e5857-1a16-4e92-b84f-49134ca6b6cd` downloaded IMF WEO files under `raw/imf_weo_202604/` but failed after trying unavailable Python packages. This repair must avoid `pandas`, `openpyxl`, or any pip install. Use Python standard library only for XLSX inspection: `zipfile`, `xml.etree.ElementTree`, `re`, `json`, `csv`, `hashlib`, and `pathlib`.

Expected files:
- `raw/imf_weo_202604/WEOApr2026all.xlsx`
- `raw/imf_weo_202604/WEOhistorical.xlsx`
- `raw/imf_weo_202604/April-2026-WEO-Database-Appendix.pdf`
- `raw/imf_weo_202604/WEO-Database-Transition-Guide.pdf`

If any file is missing or zero bytes, download it from:
- `https://data.imf.org/-/media/iData/External-Storage/Documents/2F78EE59F79143A7921E5E203D3AAA80/en/WEOApr2026all.xlsx`
- `https://data.imf.org/-/media/iData/External-Storage/Documents/977574FA66914EAD900D3FEC55C7316A/en/WEOhistorical.xlsx`
- `https://data.imf.org/-/media/iData/External-Storage/Documents/4AA1F4D0624C46E98F95988F1F83E770/en/April-2026-WEO-Database-Appendix.pdf`
- `https://data.imf.org/-/media/iData/External-Storage/Documents/2C2B2F3E671A4B11ABE756E2441FD6F0/en/WEO-Database-Transition-Guide.pdf`

Standard-library XLSX inventory:
- Verify each XLSX is a ZIP and `ZipFile.testzip()` returns `None`.
- Read `xl/workbook.xml` and `xl/_rels/workbook.xml.rels` to map sheet names to worksheet XML paths.
- For each worksheet XML, derive row/column dimensions from the `<dimension ref="...">` attribute when present; otherwise stream `row` and `c` elements to estimate max row and max column.
- Count workbook sheet names, rows, and columns. Do not extract worksheets into raw files.
- Verify each PDF starts with `%PDF`.
- Compute byte counts and SHA256 for all files.
- Write or repair `raw/imf_weo_202604/metadata.json`.

Inventory/docs:
- Update download/raw/volume inventory files, manifest/source registry/provenance files, and `raw_files.json`.
- Preserve the existing full econ briefing. Do not replace it with a short IMF-only briefing.
- `dataset_briefing.md`, `docs/public-datasets/briefings/econ.md`, and `docs/public-datasets/econ.mdx` must retain:
  - `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
  - `raw/worldbank/WDI_CSV_2026_04_09.zip`
  - `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
  - `raw/world_bank_wdi_20260409/`
- Add a `raw/imf_weo_202604/` bullet with file byte counts, hashes, sheet inventory, and remaining gaps.
- Update roadmap language so IMF WEO is now present; keep IMF databases beyond WEO, UN Comtrade, WTO, ILOSTAT, broader Eurostat/ECB, restricted microdata, and licensed/proprietary data as gaps.

Required artifacts:
- `dataset_briefing.md`
- `improvement_result.json`
- `work.md`
- `report.html`
- `result.json`

Promote artifacts:

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

Return a concise completion summary: reused/downloaded files, byte counts, hashes, XLSX sheet dimensions, PDF checks, and artifact promotion status.
