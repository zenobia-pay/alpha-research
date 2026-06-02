# Fannie Mae HPSI Maintenance Summary

## Execution

- Dataset: `econ`
- Admin execution: `778a0b44-6559-4fd0-acbf-6c7ef47a824e`
- Status endpoint: `/api/admin/remote-agent-executions/778a0b44-6559-4fd0-acbf-6c7ef47a824e`
- Prompt: `docs/canonical-runs/econ/2026-06-02T18-20-56Z/fannie-mae-hpsi-prompt.md`
- Launcher prompt copy: `docs/canonical-runs/econ/2026-06-02T18-21-30-090Z/improve-prompt.md`

The admin job reached `ready` and landed the official Fannie Mae National Housing Survey / Home Purchase Sentiment Index public monthly indicator package under `raw/fannie_mae_hpsi_20260602/`.

## Landed Raw Files

- `raw/fannie_mae_hpsi_20260602/nhs-monthly-indicator-data-092025.xlsx`: 1,065,407 bytes; SHA-256 `2d4410866aea5ede78b64c49f4ea0e3f702d38f4c0ceb86e0c9f22b6508faf97`; captured from official Fannie Mae media URL `https://www.fanniemae.com/media/56266/display` after the documented XLSX path redirected there; HTTP 200 `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- `raw/fannie_mae_hpsi_20260602/nhs-technical-notes-202503.pdf`: 319,837 bytes; SHA-256 `bb3db0b7045429a679c6751dae7655d07d847af3ee423f15a5a330c3d0c67c53`.

Workbook inventory counted 20,636 monthly rows x 48 columns from 2010-06 through 2025-09, covering the composite Home Purchase Sentiment Index and component response percentages for buying/selling conditions, home-price expectations, mortgage-rate expectations, household income outlook, and job-loss concern.

## Validation And Profile Repair

The remote execution's generated briefing/profile was too narrow and omitted existing econ inventory markers such as `raw/federal_reserve_z1/z1_csv_files_20260319.zip`, `raw/worldbank/WDI_CSV_2026_04_09.zip`, and `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`. The checked-in full briefing and MDX mirror were therefore updated manually from artifact evidence while preserving the accumulated econ inventory.

After the docs update, the live dataset profile was resynchronized from `docs/public-datasets/briefings/econ.md` with `diskInventoryProven: true` and `volumeInventoryRunId: 778a0b44-6559-4fd0-acbf-6c7ef47a824e`.

## Remaining Gap

This narrows the public Fannie Mae housing-sentiment gap, but it does not add respondent microdata, pre-2010 monthly history, other Fannie Mae survey products, Freddie/Fannie loan-level performance data, or licensed housing and real-estate datasets.
