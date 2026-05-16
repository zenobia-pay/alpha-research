# Canonical Dataset Remote-Box Briefing Refresh: History (`history`)

Execute this focused maintenance pass now inside the remote box. Do not perform broad source expansion, web search, or new provider downloads unless the mounted dataset inventories prove they are required to repair the briefing.

Field brief:

```text
History canonical dataset maintenance: refresh the mounted dataset briefing from disk, prove volume inventory fields, update docs mirrors, update the CLI-visible profile, and continue only safe public-source improvements without publishing processed analysis tables.
```

## Required Scope

1. First create the runtime work-log artifacts required by the remote-run platform: write `work.md` and `report.html` in the worker artifact output area before dataset inspection. Use `./work.md` and `./report.html`; if `run_config.json` exposes a run id or `/results/<run-id>` exists, also write `/results/<run-id>/work.md` and `/results/<run-id>/report.html`. Keep these as runtime artifacts only; do not write them into the dataset root, docs mirrors, inventories, or `dataset_briefing.md`.
2. Keep `work.md` current as you inspect the volume, write the briefing, update the profile, and perform readback. The run must not finish without a non-empty `work.md`.
3. Use the mounted dataset volume as the dataset root. Prefer `DATASET_MOUNT_PATH`; otherwise use `/mnt/alpha-research/datasets/history`.
4. Read the existing dataset state from the mounted volume: `manifest.json`, `source_registry.csv`, `source_registry.plan.json`, `download_inventory.jsonl`, `download_inventory.csv`, `download_events.jsonl`, `slack_download_alerts.jsonl`, `slack_briefing.md`, `raw_inventory.jsonl`, `raw_inventory.csv`, `volume_inventory.jsonl`, `volume_inventory.csv`, `volume_inventory_summary.json`, `volume_tree.txt`, `data_dictionary.md`, `quality_report.md`, and any existing `dataset_briefing.md`.
5. Regenerate stale or missing disk inventories from the current mounted volume before writing the briefing.
6. Write `dataset_briefing.md` at the dataset volume root. Treat that file as the authoritative output for this run.
7. Copy the exact same briefing body into `docs/public-datasets/briefings/history.md` and `docs/public-datasets/history.mdx` in the run artifact/workspace area when available.
8. Update the CLI-visible backend dataset profile from the same briefing:
   - set `briefingMarkdown` to the exact `dataset_briefing.md` body;
   - set `quality.diskInventoryProven` to `true` only after inventories are regenerated or verified from disk;
   - set `quality.volumeInventoryRunId` to the current run id;
   - set `quality.volumeInventoryUpdatedAt` to the inventory verification timestamp.
9. Read back the dataset profile through the backend and verify it contains the exact briefing and current run id. If readback fails, mark the run blocked and write the non-secret blocker.
10. Copy `dataset_briefing.md`, `docs/public-datasets/briefings/history.md`, `docs/public-datasets/history.mdx`, `improvement_result.json`, `volume_inventory_summary.json`, `work.md`, and `report.html` into the remote run artifact directory so the orchestrator can recover them.

## Briefing Contract

The briefing answers one question: what data is actually on the mounted dataset volume?

Write it as a comprehensive literal data inventory. Do not write a provider/package list.

Every bullet must be specific enough that a reader can answer: what exact table, API response, or document collection is stored; what the records represent; what grain/frequency it has; what geography it covers; what dates/vintages it covers; how many rows/objects are present when measurable; and what important columns, fields, and units mean.

Use this shape:

```md
# Data Inventory
- Consumer Price Index for All Urban Consumers, seasonally adjusted U.S. national monthly price index observations; one row per month; United States; 1947-01 through 2026-03. Data comes from FRED. The data fields are ... . The units are ...
```

For archives or packaged provider payloads already on disk, describe the extracted data-bearing files or tables. If an archive is still opaque and cannot be inspected during this focused pass, list it under blockers or caveats instead of claiming it as usable stored data.

## Result File

Write `improvement_result.json` with this shape:

```json
{
  "datasetId": "history",
  "datasetName": "History",
  "status": "completed|blocked",
  "checkedAt": "ISO-8601 timestamp",
  "diskInventoryProven": true,
  "volumeInventoryRunId": "current run id",
  "volumeInventoryUpdatedAt": "ISO-8601 timestamp",
  "briefingPath": "dataset_briefing.md",
  "docsBriefingPath": "docs/public-datasets/briefings/history.md",
  "docsPagePath": "docs/public-datasets/history.mdx",
  "profileUpdated": true,
  "profileReadbackVerified": true,
  "blockers": []
}
```

Set `diskInventoryProven`, `profileUpdated`, or `profileReadbackVerified` to `false` if proof is missing, and explain the exact non-secret blocker in `blockers`.

## Final Response

Return a concise summary with run status, files written, profile update/readback status, recovered briefing path, and whether `diskInventoryProven` is true.
