Improve the canonical `econ` dataset with official IMF World Economic Outlook (WEO) April 2026 data and supporting forecast documentation.

This is a canonical dataset maintenance job for dataset id `econ`. Do not run a user research analysis. Add provider-native source files, checksums, workbook/PDF inventory, row/sheet counts, and concise documentation so the dataset profile can truthfully describe this coverage.

Official source pages:
- https://data.imf.org/en/datasets/IMF.RES%3AWEO
- https://www.imf.org/en/publications/sprolls/world-economic-outlook-databases

Source-page facts verified on 2026-06-01:
- The IMF Data WEO page is titled `WEO`.
- The page describes the April 2026 World Economic Outlook and says WEO is published twice a year in April and October with the biannual flagship World Economic Outlook report.
- The page says the database includes selected data on national accounts, inflation, unemployment rates, balance of payments, fiscal indicators, trade for countries and country groups/aggregates, and commodity prices whose data are reported by the IMF.
- The page says data are available from 1980 to the present and projections for most data series are provided for the next five years.
- The page has a document card titled `April 2026 WEO Entire Dataset in Excel`, dated 2026-04-15, with description: the file includes the data published in the WEO database in spreadsheet format and is presented in three datasheets (Countries, Country Groups, and Commodity Prices).
- The page has a document card titled `WEO Historical Forecasts Database`, dated 2026-04-14, described as a comprehensive archive of IMF WEO historical forecasts.
- The page has a document card titled `April 2026 WEO Database Appendix`, dated 2026-04-14.

Required files to download and preserve under `raw/imf_weo_202604/`:
- `WEOApr2026all.xlsx` from `https://data.imf.org/-/media/iData/External-Storage/Documents/2F78EE59F79143A7921E5E203D3AAA80/en/WEOApr2026all.xlsx`
- `WEOhistorical.xlsx` from `https://data.imf.org/-/media/iData/External-Storage/Documents/977574FA66914EAD900D3FEC55C7316A/en/WEOhistorical.xlsx`
- `April-2026-WEO-Database-Appendix.pdf` from `https://data.imf.org/-/media/iData/External-Storage/Documents/4AA1F4D0624C46E98F95988F1F83E770/en/April-2026-WEO-Database-Appendix.pdf`
- `WEO-Database-Transition-Guide.pdf` from `https://data.imf.org/-/media/iData/External-Storage/Documents/2C2B2F3E671A4B11ABE756E2441FD6F0/en/WEO-Database-Transition-Guide.pdf`

Verified HTTP metadata locally on 2026-06-01:
- `WEOApr2026all.xlsx`: HTTP 200, content type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, content disposition `attachment; filename="WEOApr2026all.xlsx"`.
- `WEOhistorical.xlsx`: HTTP 200, content type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, content disposition `attachment; filename="WEOhistorical.xlsx"`.
- `April-2026-WEO-Database-Appendix.pdf`: HTTP 200, content type `application/pdf`, content length `523673`, content disposition `attachment; filename="April 2026 WEO Database Appendix.pdf"`.

For each downloaded file:
- Record URL, HTTP status, content type, content disposition, last-modified/header values when present, byte count, and SHA256.
- Verify XLSX files as ZIP containers and PDF file magic/header.
- Inventory workbook sheets with row and column counts. Use structured workbook readers; do not convert the full workbook into many extracted files in the canonical raw directory.
- For the April 2026 WEO workbook, capture sheet names, row counts, column counts, country/economy count, indicator count when identifiable, year coverage, and forecast/projection horizon.
- For the historical forecast workbook, capture sheet names, row counts, column counts, vintage/year coverage when identifiable, and indicator/economy coverage.
- Add a metadata JSON file in `raw/imf_weo_202604/` with the facts above.

Full briefing preservation requirements:
- Do not replace the full econ inventory with a short WEO-only briefing.
- Start from the current full `docs/public-datasets/briefings/econ.md` text on disk. If it looks truncated, fetch the current full briefing from `https://raw.githubusercontent.com/zenobia-pay/alpha-research/codex/initial-substrate/docs/public-datasets/briefings/econ.md`.
- `dataset_briefing.md`, `docs/public-datasets/briefings/econ.md`, and `docs/public-datasets/econ.mdx` must preserve existing inventory markers including:
  - `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
  - `raw/worldbank/WDI_CSV_2026_04_09.zip`
  - `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
  - `raw/world_bank_wdi_20260409/`
- Add a new `raw/imf_weo_202604/` bullet to the full briefing and MDX.
- Update the Coverage Roadmap line for international/macro coverage so additional IMF WEO is now present, while IMF datasets beyond WEO, UN Comtrade, WTO, ILOSTAT, Eurostat/ECB breadth, restricted/confidential microdata, and licensed/proprietary sources remain incomplete.

Documentation wording:
- Describe WEO as IMF biannual macroeconomic actuals/estimates/projections covering national accounts, inflation, unemployment, balance of payments, fiscal indicators, trade, commodity prices, country groups, and historical forecast vintages.
- State that WEO does not replace IMF IFS/BOP/IIP/GFS full databases, Article IV files, restricted data, national statistical-office source data, OECD/Eurostat/UN coverage, or licensed market/microdata sources.

Profile/readback:
- Set dataset profile quality/proof fields to this execution id.
- If the backend profile endpoint is unavailable from the worker but the disk artifacts are complete, leave enough evidence for local profile sync and validation.

Required files to exist and be non-placeholder:
- `dataset_briefing.md`
- `improvement_result.json`
- `work.md`
- `report.html`
- `result.json`
- `docs/public-datasets/briefings/econ.md`
- `docs/public-datasets/econ.mdx`

Final artifact promotion command must include `result.json` and marker checks:

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

Do not finish until all five artifacts are present and the five briefing markers above are present in `$RESULT_DIR/dataset_briefing.md`.

Return a short maintenance summary including file byte counts, checksums, workbook sheet/row counts, coverage facts, and artifact promotion status.
