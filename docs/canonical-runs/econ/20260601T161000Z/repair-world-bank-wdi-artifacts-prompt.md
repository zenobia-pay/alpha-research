Repair and complete the canonical `econ` World Bank WDI maintenance job.

This is a canonical dataset maintenance repair for dataset id `econ`. Do not run a user research analysis. The prior admin execution `1c358387-77bb-4387-a38f-243f18a0a15c` downloaded and inventoried the WDI package but failed because the required primary artifacts were not promoted. This repair execution must verify the disk evidence, finish docs/profile/artifacts, and make validation pass for this repair execution.

Expected existing raw package:
- `raw/world_bank_wdi_20260409/WDI_CSV.zip`
- expected source URL: `https://databank.worldbank.org/data/download/WDI_CSV.zip`
- expected redirect target: `https://databankfiles.worldbank.org/public/ddpext_download/WDI_CSV.zip`
- expected final HTTP status from initial verification: 200
- expected content type: `application/octet-stream`
- expected content length: `280478558`
- expected Last-Modified: `Thu, 09 Apr 2026 10:25:13 GMT`

First steps:
- Probe the dataset root with an actual create/delete write test.
- Verify `raw/world_bank_wdi_20260409/WDI_CSV.zip` exists, is a valid ZIP, has byte size `280478558`, and compute its SHA256.
- If the ZIP is missing or corrupt, re-download from `https://databank.worldbank.org/data/download/WDI_CSV.zip` and then verify again.
- Read `raw/world_bank_wdi_20260409/metadata.json` if present; repair or recreate it if incomplete.

Required inventory facts to preserve or recompute:
- ZIP member inventory with compressed and uncompressed sizes.
- Streaming row/column counts for CSV members; do not extract all CSVs into the canonical raw directory.
- Coverage facts from the previous failed execution should be independently verified before repeating them:
  - WDI main CSV rows: 395,276 rows and 70 columns if confirmed.
  - 265 economies if confirmed from country metadata.
  - 1,486 series if confirmed from series metadata.
  - 87 topics if confirmed from topic metadata.
  - Year span 1960-2025 if confirmed from WDI columns.
  - 1,259 indicators with at least 5 observations across 2015-2025 if confirmed.

Documentation/profile requirements:
- Ensure `docs/public-datasets/briefings/econ.md`, `docs/public-datasets/econ.mdx`, `dataset_briefing.md`, `dataset_profile.json`, inventories, manifest/source registry, and provenance files all include the World Bank WDI raw package.
- Describe WDI as broad cross-country development and macroeconomic indicators, including national accounts, prices, poverty, demographics, education, health, environment, infrastructure, trade, debt, finance, governance-adjacent, and country/series metadata where present.
- Retain remaining gaps: WDI does not replace World Bank microdata, full DataBank database families beyond WDI, IMF/OECD/Eurostat/UN sources, restricted microdata, or licensed/proprietary data.
- Update the Coverage Roadmap line for international trade, agriculture, and development so WDI is now present while UN Comtrade, WTO, ILOSTAT, additional IMF datasets, Eurostat/ECB breadth, restricted/confidential agriculture microdata, and other World Bank databases beyond WDI remain incomplete.
- Set the dataset profile/readback inventory proof fields to this repair execution id, not the failed prior execution and not the earlier USDA ERS run.

Required primary artifacts:
- `dataset_briefing.md`
- `improvement_result.json`
- `work.md`
- `report.html`

`report.html` only needs to be a concise canonical maintenance report, but it must exist and summarize source, data evidence, validation/provenance, limitations, and next steps.

Before the final response, copy the primary artifacts into the exact remote result directory so the orchestrator can collect them:

```bash
RESULT_DIR=${RESULT_DIR:-/results/$RUN_ID}
mkdir -p "$RESULT_DIR/docs/public-datasets/briefings"
cp "$DATASET_DIR/dataset_briefing.md" "$RESULT_DIR/dataset_briefing.md"
cp "$DATASET_DIR/improvement_result.json" "$RESULT_DIR/improvement_result.json"
cp "$DATASET_DIR/work.md" "$RESULT_DIR/work.md"
cp "$DATASET_DIR/report.html" "$RESULT_DIR/report.html"
cp "$DATASET_DIR/docs/public-datasets/briefings/econ.md" "$RESULT_DIR/docs/public-datasets/briefings/econ.md" 2>/dev/null || true
cp "$DATASET_DIR/docs/public-datasets/econ.mdx" "$RESULT_DIR/docs/public-datasets/econ.mdx" 2>/dev/null || true
ls -l "$RESULT_DIR"
```

Do not finish until `ls -l "$RESULT_DIR"` shows `dataset_briefing.md`, `improvement_result.json`, `work.md`, and `report.html`.

Return a short repair summary including byte count, checksum, row/member counts, coverage facts, and whether any data had to be re-downloaded.
