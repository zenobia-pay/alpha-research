# Econ Read-Only Inode Hotspot Audit

You are running an admin-owned canonical maintenance diagnostic for `econ`.

Objective: identify which top-level or second-level source trees consume the most inodes on the mounted econ canonical dataset volume, so maintainers can decide whether safe cleanup/compaction can unblock future economics-source ingestion.

Hard rules:

- Do not write, delete, rename, truncate, chmod, chown, or touch any file under `/data/datasets/econ`.
- Do not download new datasets.
- Do not update the backend dataset profile.
- Only write artifacts in the worker current directory and `/results/<run-id>`.
- Keep commands bounded. Avoid full recursive file listings in output. Counts are allowed, but output should summarize top offenders only.
- Do not follow symlinks.

Required output artifacts:

- `work.md`
- `report.html`
- `inode_hotspot_audit.json`
- `inode_hotspot_audit.md`

Required work:

1. Determine the dataset directory from `$DATASET_DIR`, `$DATASET_MOUNT_PATH`, or `/data/datasets/econ`.
2. Confirm inode pressure with:
   - `df -i "$DATASET_DIR"`
   - `df -h "$DATASET_DIR"`
3. Count file-system entries by top-level dataset subdirectory without printing every path. Include files, directories, and symlinks separately when practical.
4. Count entries under the largest top-level subdirectories at depth 2, especially `raw/`, `intermediate/`, `processed/`, `tmp/`, `scratch/`, `cache/`, or similarly named transient directories if they exist.
5. Identify whether inode usage appears concentrated in:
   - provider-native source trees that should be preserved;
   - intermediate/processed/temporary trees that might be compacted or removed after review;
   - many small metadata/artifact files;
   - unknown distribution.
6. Recommend one safe next action:
   - request a larger inode quota;
   - run a separate cleanup job targeting clearly abandoned temporary files;
   - compact many small provider-native files into provider ZIP/TAR archives only if source fidelity can be preserved;
   - or proceed with no cleanup because the inode usage is mostly canonical source material.
7. Write `inode_hotspot_audit.json` with structured fields:
   - `status`
   - `datasetDir`
   - `dfInodes`
   - `dfBytes`
   - `topLevelEntryCounts`
   - `secondLevelEntryCounts`
   - `transientDirectoryCandidates`
   - `providerNativePreservationNotes`
   - `inodeAssessment`
   - `recommendedNextAction`
8. Write `inode_hotspot_audit.md` as a compact human-readable summary.
9. Copy all output artifacts to `/results/<run-id>` if available.

Final response must be exactly:

```md
status: completed|blocked
dataset_id: econ
run_id: <run id>
inode_assessment: <one line>
recommended_next_action: <one line>
```
