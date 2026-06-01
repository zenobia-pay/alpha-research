Complete the canonical `econ` World Bank WDI maintenance job, avoiding the prior result-state directory failure.

This is a canonical dataset maintenance repair for dataset id `econ`. Do not run a user research analysis. Two prior executions worked on WDI but did not validate:
- `1c358387-77bb-4387-a38f-243f18a0a15c`: downloaded and inventoried WDI but failed without required primary artifacts.
- `480a6791-531d-48a1-86db-7753a6a8e341`: verified WDI and drafted artifacts but failed with missing `/results/<run>/.remote-agent/state/status.json.tmp` rename target.

Very first command after startup:

```bash
RESULT_DIR=${RESULT_DIR:-/results/$RUN_ID}
mkdir -p "$RESULT_DIR/.remote-agent/state" "$RESULT_DIR/docs/public-datasets/briefings"
```

Then complete only the repair work below.

Expected existing raw package:
- `raw/world_bank_wdi_20260409/WDI_CSV.zip`
- expected byte size: `280478558`
- source URL: `https://databank.worldbank.org/data/download/WDI_CSV.zip`
- redirect target: `https://databankfiles.worldbank.org/public/ddpext_download/WDI_CSV.zip`
- Last-Modified from local HEAD verification: `Thu, 09 Apr 2026 10:25:13 GMT`

Required verification:
- Probe the dataset root with an actual create/delete write test.
- Verify the ZIP exists, has byte size `280478558`, computes SHA256, and passes ZIP integrity.
- Recompute or confirm streaming CSV inventory. Do not extract all CSVs into the canonical raw directory.
- Confirm these WDI facts before documenting them: WDI main CSV row count and columns, country/economy count, series count, topic count, year span, and recent indicator coverage if feasible.

Required documentation/profile/artifact work:
- Ensure `docs/public-datasets/briefings/econ.md`, `docs/public-datasets/econ.mdx`, `dataset_briefing.md`, `dataset_profile.json`, inventories, manifest/source registry, and provenance files include the WDI raw package.
- Set profile/readback proof fields to this execution id only.
- Ensure these files exist and are non-placeholder:
  - `dataset_briefing.md`
  - `improvement_result.json`
  - `work.md`
  - `report.html`
- `report.html` must be concise but real HTML with source, evidence, limitations, and next steps.

Documentation wording:
- Describe WDI as broad cross-country development and macroeconomic indicators, including national accounts, prices, poverty, demographics, education, health, environment, infrastructure, trade, debt, finance, governance-adjacent, and country/series metadata where present.
- Say WDI does not replace World Bank microdata, full DataBank database families beyond WDI, IMF/OECD/Eurostat/UN sources, restricted microdata, or licensed/proprietary data.
- Update the Coverage Roadmap line so WDI is now present while UN Comtrade, WTO, ILOSTAT, additional IMF datasets, Eurostat/ECB breadth, restricted/confidential agriculture microdata, and other World Bank databases beyond WDI remain incomplete.

Final artifact promotion command:

```bash
RESULT_DIR=${RESULT_DIR:-/results/$RUN_ID}
mkdir -p "$RESULT_DIR/.remote-agent/state" "$RESULT_DIR/docs/public-datasets/briefings"
cp "$DATASET_DIR/dataset_briefing.md" "$RESULT_DIR/dataset_briefing.md"
cp "$DATASET_DIR/improvement_result.json" "$RESULT_DIR/improvement_result.json"
cp "$DATASET_DIR/work.md" "$RESULT_DIR/work.md"
cp "$DATASET_DIR/report.html" "$RESULT_DIR/report.html"
cp "$DATASET_DIR/docs/public-datasets/briefings/econ.md" "$RESULT_DIR/docs/public-datasets/briefings/econ.md" 2>/dev/null || true
cp "$DATASET_DIR/docs/public-datasets/econ.mdx" "$RESULT_DIR/docs/public-datasets/econ.mdx" 2>/dev/null || true
test -s "$RESULT_DIR/dataset_briefing.md"
test -s "$RESULT_DIR/improvement_result.json"
test -s "$RESULT_DIR/work.md"
test -s "$RESULT_DIR/report.html"
ls -la "$RESULT_DIR"
ls -la "$RESULT_DIR/.remote-agent/state"
```

Do not finish until the four primary artifacts are visible in `$RESULT_DIR`.

Return a short completion summary including whether the ZIP was reused or redownloaded, byte count, checksum, row/member counts, coverage facts, and artifact promotion status.
