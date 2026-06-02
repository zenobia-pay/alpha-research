# Econ BLS PPI Read-Only Inspection

You are running an admin-owned canonical maintenance diagnostic for `econ`.

Objective: inspect the already-present `raw/bls_ppi` directory on the canonical econ dataset volume and produce evidence artifacts that can support a conservative documentation/profile update. This is a read-only inspection, not a download or dataset-writing job.

Hard rules:

- Do not write, delete, rename, truncate, or touch any file under `/data/datasets/econ`.
- Do not download new datasets.
- Do not update the backend dataset profile.
- Only write artifacts in the worker current directory and `/results/<run-id>`.
- Do not print secrets, environment tokens, webhook URLs, or auth headers.
- Keep commands bounded. Inspect only `raw/bls_ppi`.

Required work:

1. Determine the dataset directory from `$DATASET_DIR`, `$DATASET_MOUNT_PATH`, or `/data/datasets/econ`.
2. Verify `raw/bls_ppi` exists and record:
   - directory size;
   - top-level file names;
   - file byte sizes and hashes for files under 100 MB;
   - archive members if files are ZIP/GZIP/XLS/CSV-like provider packages;
   - TSV/CSV/header/sample row counts if feasible without extracting large files to the dataset volume.
3. Identify the likely provider/source from file names and metadata. If the files prove Bureau of Labor Statistics Producer Price Index public data, say so; otherwise classify the source as unknown and explain why.
4. Record what the source adds to economist coverage and what it does not cover.
5. Write `bls_ppi_inventory.json` with structured fields:
   - `status`
   - `datasetDir`
   - `sourceDir`
   - `directoryExists`
   - `directorySize`
   - `files`
   - `archiveMembers`
   - `rowCounts`
   - `headers`
   - `provider`
   - `coverageSummary`
   - `limitations`
6. Write `bls_ppi_inventory.md` as a compact human-readable summary.
7. Write `work.md` describing commands run and decisions.
8. Write `report.html` with a compact summary.
9. Copy all output artifacts to `/results/<run-id>` if available.

Final response must be exactly:

```md
status: completed|blocked
dataset_id: econ
source: raw/bls_ppi
run_id: <run id>
summary: <one line>
```
