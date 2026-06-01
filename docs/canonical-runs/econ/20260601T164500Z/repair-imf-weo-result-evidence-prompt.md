Complete the `econ` IMF WEO ingest by repairing `result.json` evidence and promoting artifacts.

This is dataset maintenance for dataset id `econ`. Prior execution `7ddcc8a9-9ef2-4099-a56a-ccc909b669e2` repaired WEO metadata and briefing but failed platform quality validation because `result.json` had an empty `evidence` array.

Do not redo the whole ingest unless files are missing. Verify and reuse:
- `raw/imf_weo_202604/WEOApr2026all.xlsx`
- `raw/imf_weo_202604/WEOhistorical.xlsx`
- `raw/imf_weo_202604/April-2026-WEO-Database-Appendix.pdf`
- `raw/imf_weo_202604/WEO-Database-Transition-Guide.pdf`
- `raw/imf_weo_202604/metadata.json`

Required:
- Confirm `metadata.json` has file byte counts, SHA256 hashes, XLSX sheet inventories, and PDF header checks.
- Confirm `dataset_briefing.md` retains all existing full inventory markers plus `raw/imf_weo_202604/`:
  - `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
  - `raw/worldbank/WDI_CSV_2026_04_09.zip`
  - `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
  - `raw/world_bank_wdi_20260409/`
  - `raw/imf_weo_202604/`
- If any marker is missing, rebuild `dataset_briefing.md` from `docs/public-datasets/briefings/econ.md` after adding the IMF WEO bullet.

Write `result.json` as valid JSON with:
- `answer`: short completion summary string.
- `status`: `completed`.
- `evidence`: non-empty array with objects for each WEO source file including path, bytes, sha256, and verification.
- `claims`: non-empty array summarizing verified ingest claims.
- `limitations`: non-empty array noting IMF datasets beyond WEO and restricted/licensed sources remain incomplete.

Ensure `improvement_result.json`, `work.md`, and `report.html` exist and mention the WEO ingest.

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
python - <<'PY'
import json, os
path=os.path.join(os.environ.get('RESULT_DIR', '/results/'+os.environ.get('RUN_ID','')), 'result.json')
data=json.load(open(path))
assert isinstance(data.get('evidence'), list) and data['evidence'], 'result.json evidence must be non-empty'
PY
grep -q 'raw/federal_reserve_z1/z1_csv_files_20260319.zip' "$RESULT_DIR/dataset_briefing.md"
grep -q 'raw/worldbank/WDI_CSV_2026_04_09.zip' "$RESULT_DIR/dataset_briefing.md"
grep -q 'raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip' "$RESULT_DIR/dataset_briefing.md"
grep -q 'raw/world_bank_wdi_20260409/' "$RESULT_DIR/dataset_briefing.md"
grep -q 'raw/imf_weo_202604/' "$RESULT_DIR/dataset_briefing.md"
ls -la "$RESULT_DIR"
```

Return a concise completion summary with file count, hashes, sheet inventory status, evidence-array validation, and artifact promotion status.
