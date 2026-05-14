# Canonical Dataset Remote-Box Briefing Refresh: econ (`econ`)

Execute this focused maintenance pass now inside the remote box. Do not perform broad source expansion, web search, or new provider downloads unless the mounted dataset inventories prove they are required to repair the briefing.

Field brief:

```text
Create a disk-proven public dataset briefing for the canonical econ dataset. Inventory the mounted dataset volume, summarize the dataset contents, schemas, representative files, quality caveats, and practical research uses. Write the final briefing to dataset_briefing.md on the mounted dataset volume.
```

## Required Scope

1. Use the mounted dataset volume as the dataset root. Prefer `DATASET_MOUNT_PATH`; otherwise use `/mnt/alpha-research/datasets/econ`.
2. Read the existing dataset state from the mounted volume: `manifest.json`, `source_registry.csv`, `source_registry.plan.json`, `download_inventory.jsonl`, `download_inventory.csv`, `download_events.jsonl`, `slack_download_alerts.jsonl`, `slack_briefing.md`, `raw_inventory.jsonl`, `raw_inventory.csv`, `volume_inventory.jsonl`, `volume_inventory.csv`, `volume_inventory_summary.json`, `volume_tree.txt`, `data_dictionary.md`, `quality_report.md`, and any existing `dataset_briefing.md`.
3. Regenerate stale or missing disk inventories from the current mounted volume before writing the briefing.
4. Write `dataset_briefing.md` at the dataset volume root. Treat that file as the authoritative output for this run.
5. Copy the exact same briefing body into `docs/public-datasets/briefings/econ.md` and `docs/public-datasets/econ.mdx` in the run artifact/workspace area when available.
6. Update the CLI-visible backend dataset profile from the same briefing:
   - set `briefingMarkdown` to the exact `dataset_briefing.md` body;
   - set `quality.diskInventoryProven` to `true` only after inventories are regenerated or verified from disk;
   - set `quality.volumeInventoryRunId` to the current run id;
   - set `quality.volumeInventoryUpdatedAt` to the inventory verification timestamp.
7. Read back the dataset profile through the backend and verify it contains the exact briefing and current run id. If readback fails, mark the run blocked and write the non-secret blocker.
8. Copy `dataset_briefing.md`, `docs/public-datasets/briefings/econ.md`, `docs/public-datasets/econ.mdx`, `improvement_result.json`, and `volume_inventory_summary.json` into the remote run artifact directory so the orchestrator can recover them.

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
  "datasetId": "econ",
  "datasetName": "econ",
  "status": "completed|blocked",
  "checkedAt": "ISO-8601 timestamp",
  "diskInventoryProven": true,
  "volumeInventoryRunId": "current run id",
  "volumeInventoryUpdatedAt": "ISO-8601 timestamp",
  "briefingPath": "dataset_briefing.md",
  "docsBriefingPath": "docs/public-datasets/briefings/econ.md",
  "docsPagePath": "docs/public-datasets/econ.mdx",
  "profileUpdated": true,
  "profileReadbackVerified": true,
  "blockers": []
}
```

Set `diskInventoryProven`, `profileUpdated`, or `profileReadbackVerified` to `false` if proof is missing, and explain the exact non-secret blocker in `blockers`.

## Final Response

Return a concise summary with run status, files written, profile update/readback status, recovered briefing path, and whether `diskInventoryProven` is true.
