# Econ Manifest and Inventory Repair Prompt

Dataset: `econ`
Timestamp: 2026-06-02T20:03:00Z

Objective: Repair mounted canonical metadata after HMDA 2023 execution `bb851853-fc0c-48ad-aac6-3916f9ea8347` narrowed `manifest.json` to only three HMDA sources. Do not add new source data in this run.

Run this as an admin-owned canonical dataset maintenance job. Work only through the mounted canonical dataset path for `econ`, preferably `DATASET_MOUNT_PATH`. Do not start a user-facing research run.

Requirements:

- Before any mounted-volume change, prove the dataset root is writable with an actual create/delete probe.
- Do not download, delete, move, or overwrite provider-native raw files.
- Inspect the current mounted raw tree and current full checked-in/profile briefing.
- Rebuild mounted metadata so it is broad again:
  - `manifest.json`
  - `source_registry.csv`
  - `source_registry.plan.json`
  - `raw_inventory.jsonl`
  - `raw_inventory.csv`
  - `volume_inventory.jsonl`
  - `volume_inventory.csv`
  - `volume_inventory_summary.json`
  - `volume_tree.txt`
- The rebuilt metadata must include the current high-value markers at minimum:
  - `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
  - `raw/worldbank/WDI_CSV_2026_04_09.zip`
  - `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
  - `raw/hmda_2023_snapshot/2023_public_lar_csv.zip`
  - `raw/hmda_2024_snapshot/2024_public_lar_csv.zip`
  - `raw/zillow_research_broader_20260602/`
- Preserve the full existing `dataset_briefing.md`, `docs/public-datasets/briefings/econ.md`, and `docs/public-datasets/econ.mdx` inventory text. Do not replace the full briefing with a narrow repair-only summary.
- Write required artifacts: `dataset_briefing.md`, `improvement_result.json`, `work.md`, `report.html`, `quality_report.md`, plus the rebuilt manifest/inventory files.
- Update the CLI-visible backend profile from the full briefing and read it back. The readback must show no startup placeholder, current execution id, and the marker paths listed above.
- In `improvement_result.json`, report `status: "completed"` only if the rebuilt mounted manifest/inventory files include the marker paths above and backend readback proves the full briefing. Otherwise report `status: "blocked"` with the exact non-secret blocker.

Hard stop: If you cannot reconstruct broad metadata safely, preserve the existing full briefing as the final artifact, do not promote narrowed metadata as successful, and report blocked.
