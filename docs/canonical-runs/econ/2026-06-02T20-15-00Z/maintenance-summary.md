# Econ HMDA 2022 Snapshot Maintenance Summary

- Execution id: `0532a6a9-fd02-4bc8-9efa-55f5d0ff38fd`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/0532a6a9-fd02-4bc8-9efa-55f5d0ff38fd`
- Prompt: `docs/canonical-runs/econ/2026-06-02T20-15-00Z/hmda-2022-snapshot-prompt.md`
- Launcher prompt mirror: `docs/canonical-runs/econ/2026-06-02T20-15-09-528Z/improve-prompt.md`

## Result

The remote execution reached `ready` and landed the three official FFIEC/CFPB HMDA 2022 snapshot ZIPs under `raw/hmda_2022_snapshot/` on the mounted econ volume:

- `2022_public_lar_csv.zip`: 877,742,261 bytes; SHA-256 `df7ad5b544fe8dc7ca05de58a1975fd8970b829136f1538cea83882773e759d4`; member `2022_public_lar_csv.csv` with 6,058,473,013 uncompressed bytes.
- `2022_public_ts_csv.zip`: 182,349 bytes; SHA-256 `4fa0334c840335e977030d6a4bdf0316896c68e6d14dc640fe02eaabf01a154f`; member `2022_public_ts_csv.csv` with 413,489 uncompressed bytes.
- `2022_public_msamd_csv.zip`: 9,355 bytes; SHA-256 `0dde03482a7e2cd6f52678084d8ddb64d5ddff6faa0ed2cfca89f6b6db3f7338`; member `2022_public_msamd_csv.csv` with 20,591 uncompressed bytes plus a small `__MACOSX` metadata member.

Transcript evidence records HTTP 200 downloads, ZIP member inspection, sampled LAR header fields, and hash re-verification against the mounted files.

## Validation

`npm run canonical:dataset -- validate --dataset-id econ --execution-id 0532a6a9-fd02-4bc8-9efa-55f5d0ff38fd` remains blocked because the execution artifact `dataset_briefing.md` is still the startup placeholder and lacks the existing econ inventory markers:

- `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
- `raw/worldbank/WDI_CSV_2026_04_09.zip`
- `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`

The worker summary also reported `backend_profile_update_not_attempted`. After the run, the backend profile was repaired from the checked-in full briefing with the HMDA 2022 bullet added.

## Readback After Profile Repair

After manual profile repair, `npm run canonical:dataset -- status --dataset-id econ` reported:

- status: `disk_proven`
- writeReady: `true`
- diskInventoryProven: `true`
- volumeInventoryRunId: `0532a6a9-fd02-4bc8-9efa-55f5d0ff38fd`
- source bullets in CLI-visible profile: 105
- startup placeholder in CLI-visible profile: `false`
- required markers present in CLI-visible profile: HMDA 2022, HMDA 2023, HMDA 2024, Federal Reserve Z.1, World Bank WDI, BIS CPMI, SEC EDGAR bulk, and CFPB complaints

## Notes

This narrows the HMDA/housing-credit gap from 2023-2024 coverage to 2022-2024 coverage. It does not complete HMDA history: 2021 and earlier snapshots, dynamic API slices, documentation breadth, and restricted mortgage/credit datasets remain incomplete.
