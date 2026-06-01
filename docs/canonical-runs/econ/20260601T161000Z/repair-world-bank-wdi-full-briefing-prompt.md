Complete the canonical `econ` World Bank WDI repair with a full, non-regressed dataset briefing.

This is a canonical dataset maintenance repair for dataset id `econ`. Do not run a user research analysis.

The latest successful WDI execution `7e62060c-f402-450c-9fd3-4fbbbfdfb6f1` reached `ready` and promoted artifacts, but canonical validation rejected it because `dataset_briefing.md` was WDI-only and dropped existing econ inventory markers. This execution must preserve the full inventory and add WDI as an additional source.

Very first command:

```bash
RESULT_DIR=${RESULT_DIR:-/results/$RUN_ID}
mkdir -p "$RESULT_DIR/.remote-agent/state" "$RESULT_DIR/docs/public-datasets/briefings"
```

Required existing inventory markers that must appear in `dataset_briefing.md` and `docs/public-datasets/briefings/econ.md`:
- `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
- `raw/worldbank/WDI_CSV_2026_04_09.zip`
- `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`

Recommended full-briefing source:
- Use the existing full checked-in briefing text if available under the worker checkout or dataset docs.
- If the mounted dataset docs have been truncated, fetch the current full briefing from `https://raw.githubusercontent.com/zenobia-pay/alpha-research/codex/initial-substrate/docs/public-datasets/briefings/econ.md` and use that as the base before adding the new WDI bullet.
- Do not replace the full briefing with a short status report.

WDI evidence to verify and document:
- `raw/world_bank_wdi_20260409/WDI_CSV.zip`
- source URL: `https://databank.worldbank.org/data/download/WDI_CSV.zip`
- redirect target: `https://databankfiles.worldbank.org/public/ddpext_download/WDI_CSV.zip`
- byte size: `280478558`
- SHA-256: `1c8ccf64ccb9d502668aa8aa66fdae786d0994c3278b7ed377180021a5fc3bec`
- Last-Modified: `Thu, 09 Apr 2026 10:25:13 GMT`
- ZIP integrity passes.
- Six ZIP members covering WDICSV, country, series, footnote, series-time, and country-series metadata.
- WDICSV has 395,276 rows and 70 columns.
- Coverage: 1960-2025, 266 economies/aggregate regions, 1,486 indicators, 87 topics, and 210,606 indicator-country pairs with at least five observations in 2015-2025.

Documentation requirements:
- Add a `raw/world_bank_wdi_20260409/` bullet to the full briefing and MDX.
- Keep the existing `raw/worldbank/WDI_CSV_2026_04_09.zip` marker; the new package is an additional verified provider archive, not a deletion of the old marker.
- Update the Coverage Roadmap line so World Bank WDI is now present while UN Comtrade, WTO, ILOSTAT, additional IMF datasets, Eurostat/ECB breadth, restricted/confidential agriculture microdata, World Bank microdata, and DataBank families beyond WDI remain incomplete.
- Copy the full briefing into `dataset_briefing.md`.

Profile/readback:
- Set dataset profile quality/proof fields to this execution id.

Required files to exist and be non-placeholder:
- `dataset_briefing.md`
- `improvement_result.json`
- `work.md`
- `report.html`
- `result.json`
- `docs/public-datasets/briefings/econ.md`
- `docs/public-datasets/econ.mdx`

Final promotion command:

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
ls -la "$RESULT_DIR"
```

Do not finish until all five artifacts are present and the four briefing markers above are present in `$RESULT_DIR/dataset_briefing.md`.

Return a short completion summary with the WDI checksum, coverage counts, full-briefing marker verification, and artifact promotion status.
