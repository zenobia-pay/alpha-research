# Econ HMDA 2021 Snapshot Maintenance Summary

- Execution id: `442a2e1d-1674-4e01-be33-b7417effd57e`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/442a2e1d-1674-4e01-be33-b7417effd57e`
- Prompt: `docs/canonical-runs/econ/2026-06-02T20-36-00Z/hmda-2021-snapshot-prompt.md`
- Launcher prompt mirror: `docs/canonical-runs/econ/2026-06-02T20-37-10-109Z/improve-prompt.md`

## Result

The remote execution reached `ready` and landed the three official FFIEC/CFPB HMDA 2021 snapshot ZIPs under `raw/hmda_2021_snapshot/` on the mounted econ volume:

- `2021_public_lar_csv.zip`: 1,517,879,241 bytes; SHA-256 `20d61f6fc2e1e9c90b9199bb9075602cda718b4aa905807a6d8dec8433c7a3d3`.
- `2021_public_ts_csv.zip`: 178,067 bytes; SHA-256 `3faa308da258493c44654367627f395da4bc41b93b0a194c7d0fb92295cbb972`.
- `2021_public_msamd_csv.zip`: 9,902 bytes; SHA-256 `55912fb0e10f90eacb69ff16a54e39c233f70e696e5de257754b61ad9a86d42d`.

Evidence includes local HTTP 200 HEAD preflight for all three official URLs, worker download/ZIP validation and sample LAR header inspection, direct `modal volume ls agent-dataset /datasets/econ/raw/hmda_2021_snapshot`, and direct Modal-volume `manifest.json` inspection showing all three `raw/hmda_2021_snapshot/` entries alongside existing HMDA 2022 entries.

## Validation

`npm run canonical:dataset -- validate --dataset-id econ --execution-id 442a2e1d-1674-4e01-be33-b7417effd57e` remains blocked because the execution artifact `dataset_briefing.md` is still the startup placeholder and lacks the existing econ inventory markers:

- `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
- `raw/worldbank/WDI_CSV_2026_04_09.zip`
- `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`

After the run, the backend profile was repaired locally from the checked-in full briefing with the HMDA 2021 bullet added.

## Readback After Profile Repair

After manual profile repair, backend profile readback showed:

- status: `disk_proven`
- volumeInventoryRunId: `442a2e1d-1674-4e01-be33-b7417effd57e`
- source bullets in CLI-visible profile: 106
- startup placeholder in CLI-visible profile: `false`
- required markers present in CLI-visible profile: HMDA 2021, HMDA 2022, HMDA 2023, HMDA 2024, Federal Reserve Z.1, World Bank WDI, and BIS CPMI

## Direct Modal Control Note

This turn verified direct local control over the Modal dataset volume:

- `modal volume list` shows `agent-dataset` and `agent-results`.
- The econ root is visible at `/datasets/econ` inside `agent-dataset`.
- `modal volume get agent-dataset /datasets/econ/dataset_briefing.md -` successfully read the live mounted briefing without invoking remote Codex.

Future mechanical dataset inspection, docs repair, and metadata repair should use direct Modal volume operations first, reserving remote admin executions for cases where backend writer locks, platform job metadata, or live container execution are actually required.

## Notes

This narrows the HMDA/housing-credit gap from 2022-2024 coverage to 2021-2024 coverage. It does not complete HMDA history: 2020 and earlier snapshots, dynamic API slices, documentation breadth, and restricted mortgage/credit datasets remain incomplete.
