# Econ Read-Only Volume Capacity Audit

You are running an admin-owned canonical maintenance diagnostic for `econ`.

Objective: produce a read-only capacity audit for the econ canonical dataset volume so future additions can proceed safely after prior ENOSPC write-probe failures.

Hard rules:

- Do not write, delete, rename, truncate, or touch any file under `/data/datasets/econ`.
- Do not download new datasets.
- Do not update the backend dataset profile.
- Only write artifacts in the worker current directory and `/results/<run-id>`.
- Keep commands bounded. Use `du -sh` for top-level directories and source-level subdirectories only; do not recursively enumerate every file.

Required output artifacts:

- `work.md`
- `report.html`
- `capacity_audit.json`
- `capacity_audit.md`

Required work:

1. Determine the dataset directory from `$DATASET_DIR`, `$DATASET_MOUNT_PATH`, or `/data/datasets/econ`.
2. Run read-only filesystem checks:
   - `df -h` for the dataset directory and likely parent mounts
   - `df -i` for inode pressure
   - `du -sh "$DATASET_DIR"` if it completes quickly
   - `du -sh "$DATASET_DIR"/raw/* 2>/dev/null | sort -h | tail -30`
   - `find "$DATASET_DIR" -maxdepth 2 -type f -size +500M -printf '%s %p\n' 2>/dev/null | sort -n | tail -30`
3. Record whether ENOSPC is likely caused by bytes, inodes, mount quota, or unknown.
4. Identify the largest source packages already present, and recommend a safe next action:
   - increase volume quota;
   - clear abandoned temporary files if any are found;
   - avoid writes and perform profile-only finalization for already-present sources;
   - or proceed with small additions only.
5. Write `capacity_audit.json` with structured fields:
   - `status`
   - `datasetDir`
   - `df`
   - `dfInodes`
   - `datasetSize`
   - `largestRawDirs`
   - `largeFiles`
   - `enospcAssessment`
   - `recommendedNextAction`
6. Write `capacity_audit.md` as a compact human-readable summary.
7. Copy all output artifacts to `/results/<run-id>` if available.

Final response must be exactly:

```md
status: completed|blocked
dataset_id: econ
run_id: <run id>
enospc_assessment: <one line>
recommended_next_action: <one line>
```
