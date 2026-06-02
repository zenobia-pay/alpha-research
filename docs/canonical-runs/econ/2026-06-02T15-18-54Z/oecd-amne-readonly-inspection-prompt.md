# Econ OECD AMNE Read-Only Inspection

You are running an admin-owned canonical maintenance diagnostic for `econ`.

Objective: inspect the already-present `raw/oecd_amne` directory on the canonical econ dataset volume and produce evidence artifacts that can support a conservative documentation/profile update or repair decision. This is a read-only inspection, not a download or dataset-writing job.

Hard rules:

- Do not write, delete, rename, truncate, or touch any file under `/data/datasets/econ`.
- Do not download new datasets.
- Do not update the backend dataset profile.
- Only write artifacts in the worker current directory and `/results/<run-id>`.
- Do not print secrets, environment tokens, webhook URLs, or auth headers.
- Keep commands bounded. Inspect only `raw/oecd_amne`.

Required work:

1. Verify `raw/oecd_amne` exists.
2. Record directory size, file names, file byte sizes, hashes for files under 100 MB, archive members if any, and CSV/header/sample row counts if feasible.
3. Identify the likely provider/source from file names and metadata. If files prove OECD AMNE or multinational enterprise data, say so; otherwise classify the source as unknown and explain why.
4. Record what the source adds to economist coverage and what it does not cover.
5. Write `oecd_amne_inventory.json`, `oecd_amne_inventory.md`, `work.md`, and `report.html`.
6. Copy all output artifacts to `/results/<run-id>` if available.

Final response must be exactly:

```md
status: completed|blocked
dataset_id: econ
source: raw/oecd_amne
run_id: <run id>
summary: <one line>
```
