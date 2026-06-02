# Zillow Research ZHVI Maintenance Summary

## Execution

- Dataset: `econ`
- Admin execution: `7be31eb1-c09f-4db6-b314-9f482c0567f0`
- Status endpoint: `/api/admin/remote-agent-executions/7be31eb1-c09f-4db6-b314-9f482c0567f0`
- Prompt: `docs/canonical-runs/econ/2026-06-02T18-53-28Z/zillow-research-housing-prompt.md`
- Launcher prompt copy: `docs/canonical-runs/econ/2026-06-02T18-53-57-291Z/improve-prompt.md`

The admin job reached `ready` but canonical validation returned `blocked`: the captured `dataset_briefing.md` and profile briefing were still the startup placeholder and omitted required existing inventory markers. The worker did land a real Zillow Research CSV and update mounted inventory/manifest evidence before final briefing/profile artifact capture failed.

## Landed Raw File

- `raw/zillow_research_20260602/Metro_zhvi_uc_sfr_tier_0.33_0.67_sm_sa_month.csv`: Zillow Research public Home Value Index metro middle-tier single-family seasonally adjusted monthly CSV downloaded from `https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfr_tier_0.33_0.67_sm_sa_month.csv`, linked from the official Zillow Research data page `https://www.zillow.com/research/data/`.

Provider HEAD evidence:

- HTTP 200
- Content type: `application/octet-stream`
- Content-Length: 4,407,577
- Last-Modified: `Sat, 16 May 2026 02:00:41 GMT`
- ETag: `"f265247b8d991416a17fe42c3eba885e"`

Independent local verification of the direct provider URL found:

- Size: 4,407,577 bytes
- SHA-256: `f7aaa84a6b01e83fd9efc8a1cb7ccd442c53192972353ac779c08c3aa5cb5466`
- Shape: 895 rows x 321 columns
- Identifier columns: `RegionID`, `SizeRank`, `RegionName`, `RegionType`, `StateName`
- Monthly date columns: 2000-01-31 through 2026-04-30

## Validation And Profile Repair

`npm run canonical:dataset -- validate --dataset-id econ --execution-id 7be31eb1-c09f-4db6-b314-9f482c0567f0` returned `status: blocked` because the remote final artifacts remained placeholders and profile readback would have dropped existing markers such as `raw/federal_reserve_z1/z1_csv_files_20260319.zip`, `raw/worldbank/WDI_CSV_2026_04_09.zip`, and `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`.

The checked-in full briefing and MDX mirror were updated manually from concrete artifact evidence while preserving the accumulated econ inventory. After this docs update, the live dataset profile was resynchronized from `docs/public-datasets/briefings/econ.md` with `diskInventoryProven: true` and `volumeInventoryRunId: 7be31eb1-c09f-4db6-b314-9f482c0567f0`.

## Remaining Gap

This narrows the Zillow housing-data gap, but it is only one compact metro ZHVI seed. City/county/ZIP ZHVI, ZORI rents, inventory, listings, price cuts, sales, market heat, other Zillow metric/geography combinations, Case-Shiller, Redfin, NAR, Freddie Mac AIMI, parcel/assessor data, listings, appraisals, loan-level agency performance data, and licensed real-estate datasets remain incomplete.
