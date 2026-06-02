# Econ OECD ICIO Post-Repair Read-Only Inspection

You are running an admin-owned canonical maintenance diagnostic for `econ`.

Objective: inspect the newly landed `raw/oecd_icio/ICIO2021_2010-2014.zip` package after repair execution `b8cce548-1b56-47fb-83f5-989e96a6a336` and produce evidence artifacts for conservative docs/profile synchronization.

Hard rules:

- Do not write, delete, rename, truncate, or touch any file under `/data/datasets/econ`.
- Do not download new datasets.
- Do not update the backend dataset profile.
- Only write artifacts in the worker current directory and `/results/<run-id>`.
- Do not print secrets, environment tokens, webhook URLs, or auth headers.
- Inspect only `raw/oecd_icio`; do not extract large CSVs to the dataset volume.

Required work:

1. Verify `raw/oecd_icio/ICIO2021_2010-2014.zip` exists.
2. Record byte size, SHA-256, ZIP integrity, ZIP member names, compressed/uncompressed sizes, first headers, and row/column counts for each CSV member if feasible by streaming from the ZIP.
3. Confirm whether the files prove OECD Inter-Country Input-Output 2021 release coverage for 2010-2014.
4. Record provider, source URL if visible from existing artifacts or local metadata, coverage summary, OECD terms caveat, and limitations.
5. Write `oecd_icio_inventory.json`, `oecd_icio_inventory.md`, `work.md`, and `report.html`.
6. Copy all output artifacts to `/results/<run-id>` if available.

Final response must be exactly:

```md
status: completed|blocked
dataset_id: econ
source: raw/oecd_icio
run_id: <run id>
summary: <one line>
```
