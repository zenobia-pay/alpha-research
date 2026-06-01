Complete the canonical `econ` World Bank WDI repair with both canonical artifacts and platform `result.json` promoted.

This is a canonical dataset maintenance repair for dataset id `econ`. Do not run a user research analysis.

Prior WDI executions:
- `1c358387-77bb-4387-a38f-243f18a0a15c`: downloaded and inventoried WDI but failed without required primary artifacts.
- `480a6791-531d-48a1-86db-7753a6a8e341`: failed on missing result-state directory.
- `eda88d1e-0bec-48ff-8ff9-09071b9a9017`: fixed the result-state directory but failed platform artifact quality because `result.json` was not promoted.

Very first command:

```bash
RESULT_DIR=${RESULT_DIR:-/results/$RUN_ID}
mkdir -p "$RESULT_DIR/.remote-agent/state" "$RESULT_DIR/docs/public-datasets/briefings"
```

Required disk evidence to verify:
- `raw/world_bank_wdi_20260409/WDI_CSV.zip`
- source URL: `https://databank.worldbank.org/data/download/WDI_CSV.zip`
- redirect target: `https://databankfiles.worldbank.org/public/ddpext_download/WDI_CSV.zip`
- expected byte size: `280478558`
- expected Last-Modified: `Thu, 09 Apr 2026 10:25:13 GMT`

Verify:
- Dataset root write probe succeeds.
- WDI ZIP exists, is 280,478,558 bytes, SHA256 is computed, and ZIP integrity passes.
- Streaming CSV inventory confirms row/column/member counts and country/series/topic/year coverage. Do not extract all CSVs to the raw directory.

Ensure these dataset files are current and non-placeholder:
- `dataset_briefing.md`
- `improvement_result.json`
- `work.md`
- `report.html`
- `result.json`
- `docs/public-datasets/briefings/econ.md`
- `docs/public-datasets/econ.mdx`

Profile/readback:
- Set dataset profile quality/proof fields to this execution id.
- Public docs must say WDI is now present, while World Bank microdata, DataBank families beyond WDI, IMF/OECD/Eurostat/UN sources, restricted microdata, licensed/proprietary data, UN Comtrade, WTO, ILOSTAT, additional IMF, Eurostat/ECB breadth, restricted agriculture microdata, and other World Bank databases beyond WDI remain gaps.

Final promotion command must include `result.json`:

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
ls -la "$RESULT_DIR"
```

Do not finish until all five artifacts are present in `$RESULT_DIR`.

Return a short completion summary with ZIP byte count, checksum, WDI row/member/count coverage, and artifact promotion status.
