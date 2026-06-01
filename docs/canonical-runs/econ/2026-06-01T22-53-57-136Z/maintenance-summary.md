# Econ canonical maintenance summary

- Execution: `e6e9d7e6-277b-4d8e-a747-7a58a94d136b`
- Prompt: `docs/canonical-runs/econ/2026-06-01T22-53-57-136Z/improve-prompt.md`
- Target gap: ONS monthly GDP / monthly GDP estimate coverage.
- Result: ONS Monthly GDP time series workbook landed on the canonical volume under `raw/ons_monthly_gdp_20260601/`.
- Source: `https://www.ons.gov.uk/file?uri=/economy/grossdomesticproductgdp/datasets/gdpmonthlyestimateuktimeseriesdataset/current/mgdp.xlsx`
- File evidence: `mgdp.xlsx`, 325,834 bytes, SHA-256 `93a7e99fbef699394d474e0dd74f3b63e4fdfee0d57b1ffb2ed5e0f2bed311c0`, HTTP 200, weak ETag `W/"f5636dbe1970caa2ec29c0970d30cb447d218582--gzip"`.
- Coverage evidence: workbook sheet `data`, 358 workbook rows and 208 columns; 350 monthly observations from 1997 FEB through 2026 MAR for chained volume measure indices (2019=100) and month-on-month growth rates for headline GDP and detailed UK industry aggregates.
- Validation note: the remote execution reached `ready` and profile readback pointed at this execution, but `npm run canonical:dataset -- validate --dataset-id econ --execution-id e6e9d7e6-277b-4d8e-a747-7a58a94d136b` remains blocked because the immutable remote `dataset_briefing.md` artifact omitted older required inventory markers (`raw/federal_reserve_z1/z1_csv_files_20260319.zip`, `raw/worldbank/WDI_CSV_2026_04_09.zip`, and `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`). The checked-in full briefing was repaired from concrete artifact evidence and the live profile was resynced from that full briefing; the live canonical status is `disk_proven` with `volumeInventoryRunId` set to this execution.
- Remaining gaps: broader ONS labour market, trade, productivity, balance of payments/IIP, regional accounts, Blue Book revision histories, broader ONS API/catalog coverage, and other roadmap families remain incomplete.
