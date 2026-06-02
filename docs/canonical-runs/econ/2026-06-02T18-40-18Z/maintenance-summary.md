# Apartment List Rents Maintenance Summary

## Execution

- Dataset: `econ`
- Admin execution: `c1431e1e-900e-4696-918e-255fa6abe702`
- Status endpoint: `/api/admin/remote-agent-executions/c1431e1e-900e-4696-918e-255fa6abe702`
- Prompt: `docs/canonical-runs/econ/2026-06-02T18-40-18Z/apartment-list-rents-prompt.md`
- Launcher prompt copy: `docs/canonical-runs/econ/2026-06-02T18-40-57-631Z/improve-prompt.md`

The admin job reached `ready` but canonical validation returned `blocked`: the captured `dataset_briefing.md` and profile briefing were still the startup placeholder and omitted required existing inventory markers. The worker did, however, land real provider CSVs under `raw/apartment_list_rents_20260602/` before timing out while finalizing briefing/profile artifacts.

## Landed Raw Files

The run discovered the official Apartment List research data page `https://www.apartmentlist.com/research/category/data-rent-estimates/`, whose page data exposed Contentful CDN CSV assets for the May 2026 update:

- `raw/apartment_list_rents_20260602/Apartment_List_Rent_Estimates_2026_05.csv`: 2,506,911 bytes; SHA-256 `7d06c6b30c2eb024c1a86e450ac0b79958b74276fafcd9e434852a0f56a968ca`; 3,942 rows x 121 columns; historic rent estimates from January 2017 to present.
- `raw/apartment_list_rents_20260602/Apartment_List_Rent_Estimates_Summary_2026_05.csv`: 172,820 bytes; SHA-256 `e549e8d2029092da80c819d79e2b21e6ccb3a2025d3a18a17afe4f9d542a1a48`; 1,314 rows x 14 columns; current-month summary.
- `raw/apartment_list_rents_20260602/Apartment_List_Rent_Growth_MoM_2026_05.csv`: 1,177,641 bytes; SHA-256 `233a48e83e7feb365a49d35b008e5af9209bbf5640d85771b0eae6bfcc690630`; 1,314 rows x 119 columns; month-over-month rent growth from February 2017 to present.
- `raw/apartment_list_rents_20260602/Apartment_List_Rent_Growth_YoY_2026_05.csv`: 1,064,685 bytes; SHA-256 `53a955fc681a6a8ff15b5635eac8cc415abe08d9d43f28d309665eec6279f4c8`; 1,314 rows x 108 columns; year-over-year rent growth from January 2018 to present.
- `raw/apartment_list_rents_20260602/Apartment_List_Vacancy_Index_2026_05.csv`: 1,196,277 bytes; SHA-256 `f173587321280827c0b7c9d4536d723fe651a78ac98e12afe56f3fcb5e4f4dc8`; 538 rows x 120 columns; vacancy index from January 2017 to present.
- `raw/apartment_list_rents_20260602/Apartment_List_Time_On_Market_2026_05.csv`: 98,997 bytes; SHA-256 `d515c57d4231018ec90574b0e9c441261cfe712b361a1538ad40871c88da4692`; 200 rows x 96 columns; time on market from January 2019 to present.

First columns observed across files include `location_name`, `location_type`, `location_fips_code`, `population`, and `state`.

## Validation And Profile Repair

`npm run canonical:dataset -- validate --dataset-id econ --execution-id c1431e1e-900e-4696-918e-255fa6abe702` returned `status: blocked` because the remote final artifacts remained placeholders and profile readback would have dropped existing markers such as `raw/federal_reserve_z1/z1_csv_files_20260319.zip`, `raw/worldbank/WDI_CSV_2026_04_09.zip`, and `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`.

The checked-in full briefing and MDX mirror were updated manually from concrete artifact evidence while preserving the accumulated econ inventory. After this docs update, the live dataset profile was resynchronized from `docs/public-datasets/briefings/econ.md` with `diskInventoryProven: true` and `volumeInventoryRunId: c1431e1e-900e-4696-918e-255fa6abe702`.

## Remaining Gap

This narrows the Apartment List rent-data gap, but it does not add Case-Shiller, Redfin, NAR, Freddie Mac AIMI, Fannie Mae survey microdata and other Fannie Mae products, parcel/assessor data, listings, appraisals, loan-level agency performance data, or licensed real-estate datasets.
