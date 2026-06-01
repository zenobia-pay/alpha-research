# Econ Scoped Remote-Agent Cache Cleanup

You are running an admin-owned canonical maintenance cleanup for `econ`.

Objective: recover inode capacity on the mounted econ canonical dataset volume by deleting only stale remote-agent automation cache/workspace directories identified by the 2026-06-01 inode-hotspot audit.

Context:

- Prior audit run: `f8c48d5e-2a63-4e55-aaab-651e2681b1df`.
- The audit found `df -i /data/datasets/econ` at 500,000 inodes, 499,998 used, 2 free, 100% inode usage.
- The audit found `.remote-agent` consumed about 84,041 entries, `existing/.remote-agent` consumed about 6,241 entries, and `raw/` provider-native data consumed only about 787 entries.

Hard rules:

- You may delete only these cache/workspace targets when they exist:
  - `/data/datasets/econ/.remote-agent/codex-home`
  - `/data/datasets/econ/.remote-agent/workspaces`
  - `/data/datasets/econ/existing/.remote-agent`
- Do not delete `/data/datasets/econ/.remote-agent/runs`.
- Do not delete `/data/datasets/econ/.remote-agent` itself unless it is empty after cleanup.
- Do not write, delete, rename, truncate, chmod, chown, or touch anything under:
  - `/data/datasets/econ/raw`
  - `/data/datasets/econ/intermediate`
  - `/data/datasets/econ/docs`
  - `/data/datasets/econ/scripts`
  - `/data/datasets/econ/manifest.json`
  - any provider-native source directory or file.
- Do not download new datasets.
- Do not update the backend dataset profile.
- Write artifacts only in the worker current directory and `/results/<run-id>`.

Safety checks before deletion:

1. Determine the dataset directory from `$DATASET_DIR`, `$DATASET_MOUNT_PATH`, or `/data/datasets/econ`.
2. Record `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"` before cleanup.
3. List `/data/datasets/econ/.remote-agent/runs` if present. If it contains evidence of active in-progress runs, block and do not delete anything. Treat files or directories modified in the last 2 hours as active unless they are clearly completed archival metadata.
4. For each deletion candidate, record:
   - whether it exists;
   - entry counts before deletion;
   - latest modification timestamp visible from `find` or `stat`;
   - reason it is safe or unsafe to delete.
5. If a candidate appears active or ambiguous, do not delete it. Continue with other safe candidates.

Cleanup:

- Delete only candidates that passed the safety checks.
- Use bounded commands and avoid printing full recursive file lists.
- After deletion, run `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"` again.
- Recount top-level entries for `.remote-agent`, `existing`, `raw`, and `intermediate` if they exist.

Required output artifacts:

- `work.md`
- `report.html`
- `cleanup_result.json`
- `inode_recheck.md`
- `dataset_briefing.md`
- `improvement_result.json`

`cleanup_result.json` and `improvement_result.json` must include:

- `status`: `completed` or `blocked`
- `datasetId`: `econ`
- `runId`: current execution id if available
- `deletedTargets`: array
- `skippedTargets`: array
- `beforeDfInodes`
- `afterDfInodes`
- `beforeDfBytes`
- `afterDfBytes`
- `inodeRecoveryAssessment`
- `recommendedNextAction`
- `profileUpdated`: `false`
- `backendProfileUnchangedReason`: `profile updates intentionally disabled for scoped cleanup; local maintainer may sync docs/profile after inspecting artifacts`

Final response must be exactly:

```md
status: completed|blocked
dataset_id: econ
run_id: <run id>
deleted_targets: <comma-separated targets or none>
inode_recovery_assessment: <one line>
recommended_next_action: <one line>
```
