# Econ Compact Ingestion: IRS Statistics of Income Public Finance

You are running an admin-owned canonical dataset improvement for `econ`.

Objective: add one compact, high-value public finance and tax source family to the econ canonical dataset: IRS Statistics of Income (SOI) public individual income tax ZIP-code/county/state datasets or official SOI table packages.

Why this source:

- The current coverage roadmap explicitly names tax and public finance as missing or incomplete.
- IRS SOI data are central for economists studying income distribution, tax policy, migration, geographic inequality, and fiscal incidence.
- Official SOI packages can be stored compactly as provider-native files without expanding thousands of small files.

Dataset and storage constraints:

- Use the mounted dataset directory from `$DATASET_DIR`, `$DATASET_MOUNT_PATH`, or `/data/datasets/econ`.
- Before writing, record `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"`.
- Perform a real write/delete probe in the dataset root before downloads. If it fails, block as `dataset_dir_not_writable` with the exact non-secret filesystem error.
- Do not delete, rename, or modify existing provider-native raw sources.
- Do not touch `.remote-agent/runs`.
- Keep writes scoped to `raw/irs_soi/` plus required run artifacts/docs/profile updates.
- If `df -i` shows fewer than 20,000 free inodes before writing, block before downloading.
- Use official IRS or Treasury URLs only. Do not use mirrors.
- Prefer compact provider-native ZIP/XLSX/CSV files. Do not expand archives.

Required source work:

1. Create `raw/irs_soi/`.
2. Discover official IRS SOI public data URLs from `https://www.irs.gov/statistics/soi-tax-stats-individual-income-tax-statistics-zip-code-data-soi` or adjacent official IRS SOI pages.
3. Download a compact initial canonical slice. Prefer the latest available individual income tax ZIP-code data package and its documentation if official direct links are available. If ZIP-code data direct links are blocked or too large, use a compact official SOI county/state table package and document the reason.
4. Preserve files exactly as downloaded under `raw/irs_soi/`.
5. For each file compute:
   - byte count
   - SHA-256 hash
   - file format
   - row count / worksheet dimensions / archive member inventory without full extraction
   - year coverage
   - geography coverage
   - main tax/income measures
6. Record source license/access notes from IRS public data context.
7. Record `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"` after writing.

Required profile/docs work:

- Append a precise inventory bullet for the new `raw/irs_soi/` files to:
  - `dataset_briefing.md`
  - `docs/public-datasets/briefings/econ.md`
  - `docs/public-datasets/econ.mdx`
- Preserve the complete existing econ inventory. Do not replace it with a short source-only briefing.
- Update the backend dataset profile by POSTing the exact full updated briefing markdown to `POST /api/cli/datasets/econ/profile` if authenticated profile update is available in the worker.
- Read back `GET /api/cli/datasets/econ` and verify:
  - the returned `briefingMarkdown` contains the full updated inventory and the IRS SOI bullet;
  - `profile.quality.diskInventoryProven` is `true`;
  - `profile.quality.volumeInventoryRunId` equals this execution id;
  - `describedRunId` equals this execution id.
- If profile update/readback fails, record the exact non-secret failure in `improvement_result.json`; do not claim validated completion.

Required output artifacts:

- `work.md`
- `report.html`
- `dataset_briefing.md`
- `improvement_result.json`
- `download_inventory.jsonl`
- `download_inventory.csv`
- `raw_inventory.jsonl`
- `raw_inventory.csv`
- `docs/public-datasets/briefings/econ.md`
- `docs/public-datasets/econ.mdx`
- `slack_download_alerts.jsonl`
- `slack_briefing.md`

`improvement_result.json` must include:

- `status`: `completed` or `blocked`
- `datasetId`: `econ`
- `source`: `IRS Statistics of Income`
- `pathAdded`: list of `raw/irs_soi/...` files or `null`
- `downloadedFiles`
- `rowCounts`
- `fieldCounts`
- `timeCoverage`
- `geographyCoverage`
- `byteCounts`
- `sha256`
- `beforeDfInodes`
- `afterDfInodes`
- `profileUpdated`
- `profileReadbackVerified`
- `blockers`
- `recommendedNextAction`

Final response must be exactly:

```md
status: completed|blocked
dataset_id: econ
run_id: <run id>
source: IRS Statistics of Income
path_added: <paths or none>
profile_updated: true|false
recommended_next_action: <one line>
```
