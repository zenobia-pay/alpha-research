# Econ Census BPS repair run

- Execution id: `b4a0cb4b-6773-42b4-a9ae-3494f9e5e92c`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/b4a0cb4b-6773-42b4-a9ae-3494f9e5e92c`
- Target: repair and verify official U.S. Census Building Permits Survey Master Data Set files under `/data/datasets/econ/raw/census_bps_master_202604/`.

## Outcome

The repair run completed with status `ready` and repaired the Census BPS source evidence:

- Redownloaded `BPS_Compiled_File_202604.zip` with a quoted official Census URL.
- Verified `BPS_Compiled_File_202604.zip` is 458,582,881 bytes.
- Verified the ZIP with `unzip -t`.
- Recorded SHA-256 `d39854daab95c7f2e2ba5a3ae49162bfc750ecb0933ef48a6632e64ad089a391`.
- Inspected archive member `New_Master_python_m2604.csv` and recorded 11,674,305 rows x 63 columns.
- Preserved companion documentation and sample files as provider-native files:
  - `Compiled_Data_Documentation.docx`, 28,819 bytes, SHA-256 `30700b396db38e30920f09b9b8f5392c338464f66e7b5ac3072c21906923a656`.
  - `Compiled_File_Sample.csv`, 6,617 bytes, SHA-256 `42602ebd35009b6691b907936a38321a837585a8be69d06d64983b2839adf356`.

## Profile repair

The remote worker updated the backend profile with a shortened BPS-only `dataset_briefing.md`, which caused canonical validation to block on missing existing inventory markers. The checked-in full briefing was manually repaired by adding only the BPS bullet and preserving all prior econ inventory. The MDX mirror was regenerated from that full briefing, and the backend profile was resynced from the checked-in full briefing.

After repair, `npm run canonical:dataset -- status --dataset-id econ` reported:

- `diskInventoryProven: true`
- `volumeInventoryRunId: b4a0cb4b-6773-42b4-a9ae-3494f9e5e92c`
- `volumeInventoryUpdatedAt: 2026-06-01T20:17:19.069Z`

`npm run canonical:dataset -- validate --dataset-id econ --execution-id b4a0cb4b-6773-42b4-a9ae-3494f9e5e92c` still blocks because the immutable run-collected `dataset_briefing.md` artifact is the shortened BPS-only briefing. The backend profile readback and checked-in briefing contain the full inventory markers.
