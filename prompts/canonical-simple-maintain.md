# Maintain Canonical Dataset: {datasetName} (`{datasetId}`)

You are maintaining one canonical dataset folder. Keep this simple.

## Paths

Use these paths:

```bash
RUN_ID="${REMOTE_AGENT_EXECUTION_ID:-${RUN_ID:-}}"
if [ -z "$RUN_ID" ] && [ -f run_config.json ]; then
  RUN_ID="$(node -e "const c=require('./run_config.json'); console.log(c.remoteAgentExecutionId||c.executionId||c.runId||'')" 2>/dev/null || true)"
fi
if [ -z "$RUN_ID" ]; then RUN_ID="$(basename "$PWD")"; fi

if [ -n "${DATASET_DIR:-}" ]; then
  DATASET_DIR_CANDIDATES="$DATASET_DIR"
else
  DATASET_DIR_CANDIDATES="${DATASET_MOUNT_PATH:-} /mnt/alpha-research/datasets/{datasetId} /data/datasets/{datasetId} ./dataset"
fi

DATASET_DIR=""
for candidate in $DATASET_DIR_CANDIDATES; do
  if [ -d "$candidate" ]; then
    DATASET_DIR="$(cd "$candidate" && pwd -P)"
    break
  fi
done
if [ -z "$DATASET_DIR" ]; then DATASET_DIR="${DATASET_MOUNT_PATH:-/mnt/alpha-research/datasets/{datasetId}}"; fi

ARTIFACT_DIR="${ARTIFACT_DIR:-/results/$RUN_ID}"
mkdir -p "$ARTIFACT_DIR"
```

Write dataset data only under `$DATASET_DIR`. Prefer the platform mount path from `DATASET_MOUNT_PATH` or `/mnt/alpha-research/datasets/{datasetId}`; use `/data/datasets/{datasetId}` only if it is the available writable canonical mount. Write execution deliverables to both the current working directory and `$ARTIFACT_DIR`.

## Required First Step

Before any planning, create and export runtime files:

```bash
printf '# Work Log\n\nStarted canonical simple maintenance for {datasetId}.\n' > work.md
printf '<!doctype html><title>Canonical maintenance</title><h1>Canonical maintenance started</h1>\n' > report.html
cp work.md report.html "$ARTIFACT_DIR"/
```

Then prove whether the dataset folder is writable:

```bash
if [ ! -d "$DATASET_DIR" ]; then
  DATASET_DIR="$DATASET_DIR" RUN_ID="$RUN_ID" node -e 'const fs=require("fs"), cp=require("child_process"); const datasetDir=process.env.DATASET_DIR, runId=process.env.RUN_ID; const sh=(cmd)=>{try{return cp.execSync(cmd,{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim()}catch(e){return `${e.stdout||""}${e.stderr||""}`.trim() || `exit ${e.status ?? "unknown"}`}}; fs.writeFileSync("improvement_result.json", JSON.stringify({status:"blocked",blocker:"dataset_dir_missing",datasetDir,runId,diagnostics:{whoami:sh("whoami"),id:sh("id"),paths:sh(`ls -ld /data /data/datasets ${JSON.stringify(datasetDir)} 2>&1`),mounts:sh("mount | grep -E \" /data|datasets|modal\" || true"),hint:"dataset-improvement with datasetAccess=write-version should mount a writable canonical dataset directory"}}, null, 2)+"\n")'
  cp improvement_result.json "$ARTIFACT_DIR"/
  exit 0
fi

WRITE_TEST_ERROR="$(touch "$DATASET_DIR/.write_test_$RUN_ID" 2>&1 >/dev/null || true)"
if [ -n "$WRITE_TEST_ERROR" ]; then
  if [ -f "$DATASET_DIR/dataset_briefing.md" ]; then cp "$DATASET_DIR/dataset_briefing.md" dataset_briefing.md; fi
  if [ ! -f dataset_briefing.md ] && [ -f ./dataset/dataset_briefing.md ]; then cp ./dataset/dataset_briefing.md dataset_briefing.md; fi
  if [ ! -f dataset_briefing.md ]; then printf '# Data Inventory\n- No briefing could be recovered because the dataset directory was not writable and no existing briefing was found.\n' > dataset_briefing.md; fi
  DATASET_DIR="$DATASET_DIR" RUN_ID="$RUN_ID" WRITE_TEST_ERROR="$WRITE_TEST_ERROR" node -e 'const fs=require("fs"), cp=require("child_process"); const datasetDir=process.env.DATASET_DIR, runId=process.env.RUN_ID; const sh=(cmd)=>{try{return cp.execSync(cmd,{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim()}catch(e){return `${e.stdout||""}${e.stderr||""}`.trim() || `exit ${e.status ?? "unknown"}`}}; fs.writeFileSync("improvement_result.json", JSON.stringify({status:"blocked",blocker:"dataset_dir_not_writable",datasetDir,runId,diagnostics:{writeTestError:process.env.WRITE_TEST_ERROR,whoami:sh("whoami"),id:sh("id"),paths:sh(`ls -ld /data /data/datasets ${JSON.stringify(datasetDir)} 2>&1`),mounts:sh("mount | grep -E \" /data|datasets|modal\" || true"),hint:"backend should honor kind=dataset-improvement plus datasetAccess=write-version with a writable Modal volume mount"}}, null, 2)+"\n")'
  cp dataset_briefing.md improvement_result.json "$ARTIFACT_DIR"/
  exit 0
fi
rm -f "$DATASET_DIR/.write_test_$RUN_ID"
```

Do not continue if the dataset directory is missing or not writable. The blocked path above is still required to export `dataset_briefing.md` and `improvement_result.json`. If the dataset is not writable but an existing briefing is readable, preserve that exact existing briefing in `./dataset_briefing.md` and `$ARTIFACT_DIR/dataset_briefing.md`; do not replace it with a placeholder.

## Job

1. Inspect `$DATASET_DIR`.
2. Search the web for one small public raw dataset that improves `{datasetId}`.
3. Download provider-native raw files under `$DATASET_DIR/raw/<source>/`.
4. Write provenance and inventory files under `$DATASET_DIR`.
5. Walk `$DATASET_DIR` and rewrite `$DATASET_DIR/dataset_briefing.md` as a literal inventory of data actually on disk.
6. Copy `$DATASET_DIR/dataset_briefing.md` to `./dataset_briefing.md` and `$ARTIFACT_DIR/dataset_briefing.md`.
7. Write `improvement_result.json` in the current directory and `$ARTIFACT_DIR`.
8. Update the CLI-visible dataset profile from the exact briefing body and read it back. Completion requires readback to show this run id in the profile proof; if profile update or readback is unavailable, write `improvement_result.json` with `status: "blocked"` and the exact non-secret blocker.

## Briefing Rules

`dataset_briefing.md` must start with:

```md
# Data Inventory
```

Every bullet must describe concrete data present on disk: file/table, record grain, geography, time coverage, row/object counts when measurable, important fields, units, and caveats.

## Required Artifacts

Before final response, this must succeed:

```bash
ls -l work.md report.html dataset_briefing.md improvement_result.json
ls -l "$ARTIFACT_DIR/work.md" "$ARTIFACT_DIR/report.html" "$ARTIFACT_DIR/dataset_briefing.md" "$ARTIFACT_DIR/improvement_result.json"
```

If anything blocks after startup, still write and copy `dataset_briefing.md` and `improvement_result.json` as described above.

## Final Response

Return only:

```md
status: completed|blocked
dataset_id: {datasetId}
run_id: <run id>
dataset_dir: <dataset dir>
artifact_dir: <artifact dir>
briefing_bytes: <bytes>
blockers:
- <none or blocker>
```
