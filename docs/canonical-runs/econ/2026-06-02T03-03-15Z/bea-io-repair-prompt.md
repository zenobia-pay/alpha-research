# Econ BEA IO Repair

You are running an admin-owned canonical improvement job for `econ`.

Objective: repair the known-bad `raw/bea_io` source by replacing the captured BEA Data Tools HTML 404 payload with valid U.S. Bureau of Economic Analysis input-output, supply-use, or industry accounts public source files, then produce canonical inventory artifacts for profile/docs synchronization.

Context:

- Prior read-only inspection `34823f9d-0d71-4299-bf14-87aaa0a099a6` found `/data/datasets/econ/raw/bea_io/AllTablesIOUse_Before_Redefinitions_DETAIL_2022.zip` was only a 26 KB HTML 404 page, not a valid ZIP.
- Do not claim BEA IO coverage unless resulting files are real BEA tabular packages with valid ZIP/XLS/CSV signatures, headers, and data rows or workbook sheets.

Hard rules:

- This is an admin-owned canonical dataset repair job for `econ`, not a user-facing research run.
- Use the mounted dataset directory from `$DATASET_DIR`, `$DATASET_MOUNT_PATH`, or `/data/datasets/econ`.
- Before writing under the dataset directory, perform an actual create/write/delete probe in the dataset root or `raw/bea_io`; if it fails, stop with blocker `dataset_dir_not_writable` and the non-secret filesystem error.
- Preserve provider-native public source files only. Do not create merged panels, derived fields, cross-source joins, or analysis artifacts.
- Reject and do not promote HTML error pages, XML AccessDenied pages, empty files, or non-BEA payloads.
- Keep downloads bounded to a compact BEA IO seed package such as the 2022 detailed use table or official make/use/supply-use public files.
- Do not print secrets, tokens, webhook URLs, or auth headers.

Required acquisition:

1. Create or reuse `raw/bea_io`.
2. Attempt to download valid official BEA input-output/industry accounts public files. Prefer stable BEA apps/download URLs or BEA API endpoints that return ZIP/XLS/CSV payloads.
3. At minimum, land one valid BEA IO/use-table package and any companion metadata needed to interpret it.
4. For every downloaded candidate, validate HTTP status/final URL, byte size, file signature, non-HTML content, ZIP integrity or workbook/CSV readability, row/sheet counts, and SHA-256.
5. If BEA blocks access or the endpoint shape has changed, write a blocked result and explain the exact non-secret failure; do not update profile/docs as successful.

Required artifacts:

- `manifest.json`
- `source_registry.csv`
- `source_registry.plan.json`
- `download_inventory.jsonl`
- `download_inventory.csv`
- `download_events.jsonl`
- `slack_download_alerts.jsonl`
- `slack_briefing.md`
- `raw_inventory.jsonl`
- `raw_inventory.csv`
- `volume_inventory.jsonl`
- `volume_inventory.csv`
- `volume_inventory_summary.json`
- `volume_tree.txt`
- `data_dictionary.md`
- `quality_report.md`
- `dataset_briefing.md`
- `improvement_result.json`
- `work.md`
- `report.html`
- docs mirrors when possible:
  - `docs/public-datasets/briefings/econ.md`
  - `docs/public-datasets/econ.mdx`

Briefing/profile requirements:

- If valid BEA IO files are landed, update the dataset briefing/docs mirror with a conservative `raw/bea_io/` inventory entry including file names, sizes, hashes, row/sheet counts, provider, and limitations.
- Keep existing inventory entries intact.
- Remove or supersede the prior gap-audit statement that BEA IO coverage remains absent only if the new landed files prove real coverage.
- Update backend profile/readback only after successful validation.

Final response must be exactly:

```md
status: completed|blocked
dataset_id: econ
source: raw/bea_io
run_id: <run id>
summary: <one line>
```
