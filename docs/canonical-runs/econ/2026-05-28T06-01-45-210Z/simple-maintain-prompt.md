# Maintain Canonical Dataset: Econ (`econ`)

You are maintaining one canonical dataset folder. Keep this simple.

## Paths

Use these paths:

```bash
RUN_ID="${REMOTE_AGENT_EXECUTION_ID:-${RUN_ID:-}}"
if [ -z "$RUN_ID" ] && [ -f run_config.json ]; then
  RUN_ID="$(node -e "const c=require('./run_config.json'); console.log(c.remoteAgentExecutionId||c.executionId||c.runId||'')" 2>/dev/null || true)"
fi
if [ -z "$RUN_ID" ]; then RUN_ID="$(basename "$PWD")"; fi

DATASET_DIR="${DATASET_DIR:-/data/datasets/econ}"
if [ ! -d "$DATASET_DIR" ] && [ -d ./dataset ]; then DATASET_DIR="$PWD/dataset"; fi

ARTIFACT_DIR="${ARTIFACT_DIR:-/results/$RUN_ID}"
mkdir -p "$ARTIFACT_DIR"
```

Write dataset data only under `$DATASET_DIR`. Write execution deliverables to both the current working directory and `$ARTIFACT_DIR`.

## Required First Step

Before any planning, create and export runtime files:

```bash
printf '# Work Log\n\nStarted canonical simple maintenance for econ.\n' > work.md
printf '<!doctype html><title>Canonical maintenance</title><h1>Canonical maintenance started</h1>\n' > report.html
cp work.md report.html "$ARTIFACT_DIR"/
```

Then prove whether the dataset folder is writable:

```bash
if [ ! -d "$DATASET_DIR" ]; then
  printf '{"status":"blocked","blocker":"dataset_dir_missing","datasetDir":"%s","runId":"%s"}\n' "$DATASET_DIR" "$RUN_ID" > improvement_result.json
  cp improvement_result.json "$ARTIFACT_DIR"/
  exit 0
fi

if ! touch "$DATASET_DIR/.write_test_$RUN_ID" 2>/dev/null; then
  if [ -f "$DATASET_DIR/dataset_briefing.md" ]; then cp "$DATASET_DIR/dataset_briefing.md" dataset_briefing.md; fi
  if [ ! -f dataset_briefing.md ] && [ -f ./dataset/dataset_briefing.md ]; then cp ./dataset/dataset_briefing.md dataset_briefing.md; fi
  if [ ! -f dataset_briefing.md ]; then printf '# Data Inventory\n- No briefing could be recovered because the dataset directory was not writable and no existing briefing was found.\n' > dataset_briefing.md; fi
  printf '{"status":"blocked","blocker":"dataset_dir_not_writable","datasetDir":"%s","runId":"%s"}\n' "$DATASET_DIR" "$RUN_ID" > improvement_result.json
  cp dataset_briefing.md improvement_result.json "$ARTIFACT_DIR"/
  exit 0
fi
rm -f "$DATASET_DIR/.write_test_$RUN_ID"
```

Do not continue if the dataset directory is missing or not writable. The blocked path above is still required to export `dataset_briefing.md` and `improvement_result.json`. If the dataset is not writable but an existing briefing is readable, preserve that exact existing briefing in `./dataset_briefing.md` and `$ARTIFACT_DIR/dataset_briefing.md`; do not replace it with a placeholder.

## Job

1. Inspect `$DATASET_DIR`.
2. Search the web for one small public raw dataset that improves `econ`.
3. Download provider-native raw files under `$DATASET_DIR/raw/<source>/`.
4. Write provenance and inventory files under `$DATASET_DIR`.
5. Walk `$DATASET_DIR` and rewrite `$DATASET_DIR/dataset_briefing.md` as a literal inventory of data actually on disk.
6. Copy `$DATASET_DIR/dataset_briefing.md` to `./dataset_briefing.md` and `$ARTIFACT_DIR/dataset_briefing.md`.
7. Write `improvement_result.json` in the current directory and `$ARTIFACT_DIR`.
8. Update the CLI-visible dataset profile from the exact briefing body when credentials/session are available.

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
dataset_id: econ
run_id: <run id>
dataset_dir: <dataset dir>
artifact_dir: <artifact dir>
briefing_bytes: <bytes>
blockers:
- <none or blocker>
```
