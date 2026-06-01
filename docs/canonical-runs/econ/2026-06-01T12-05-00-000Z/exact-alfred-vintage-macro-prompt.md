# Econ Compact Ingestion: ALFRED Vintage Macro Series

You are running an admin-owned canonical dataset improvement for `econ`.

Objective: add one compact, high-value macro/vintage source family to the econ canonical dataset: ALFRED vintage observations for core U.S. macroeconomic series.

Why this source:

- The current coverage roadmap explicitly names macro/vintage data as a top missing source family.
- Vintage macro data are essential for real-time forecasting, policy evaluation, nowcasting, and measuring revisions.
- ALFRED/FRED CSV downloads can be stored compactly as provider-native CSV files without expanding large archives or consuming many inodes.

Dataset and storage constraints:

- Use the mounted dataset directory from `$DATASET_DIR`, `$DATASET_MOUNT_PATH`, or `/data/datasets/econ`.
- Before writing, record `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"`.
- Perform a real write/delete probe in the dataset root before downloads. If it fails, block as `dataset_dir_not_writable` with the exact non-secret filesystem error.
- Do not delete, rename, or modify existing provider-native raw sources.
- Do not touch `.remote-agent/runs`.
- Keep writes scoped to `raw/alfred/` plus required run artifacts/docs/profile updates.
- If `df -i` shows fewer than 20,000 free inodes before writing, block before downloading.
- Do not require or ask for a FRED API key. Use public ALFRED/FRED CSV endpoints only.

Required source work:

1. Create `raw/alfred/`.
2. Download provider-native ALFRED CSV files for this initial compact vintage slice:
   - `GDP`
   - `UNRATE`
   - `CPIAUCSL`
   - `PAYEMS`
   - `FEDFUNDS`
   - `DGS10`
3. Prefer public ALFRED graph CSV URLs that preserve vintage dates when available, for example `https://alfred.stlouisfed.org/graph/fredgraph.csv?id=<SERIES_ID>`. If that endpoint redirects or returns non-vintage FRED data, record the exact response and use the best public ALFRED CSV export URL discovered from the official ALFRED page for that series. Do not use unofficial mirrors.
4. Save files exactly as downloaded under `raw/alfred/<SERIES_ID>_alfred.csv`.
5. For each file compute:
   - byte count
   - SHA-256 hash
   - header columns
   - row count
   - observation date coverage
   - vintage date coverage if vintage columns are present
   - whether the file appears to be true vintage data or only latest observations
6. Record source license/access notes from FRED/ALFRED public terms context.
7. Record `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"` after writing.

Required profile/docs work:

- Append a precise inventory bullet for the new `raw/alfred/` files to:
  - `dataset_briefing.md`
  - `docs/public-datasets/briefings/econ.md`
  - `docs/public-datasets/econ.mdx`
- Preserve the complete existing econ inventory. Do not replace it with a short source-only briefing.
- Update the backend dataset profile by POSTing the exact full updated briefing markdown to `POST /api/cli/datasets/econ/profile` if authenticated profile update is available in the worker.
- Read back `GET /api/cli/datasets/econ` and verify:
  - the returned `briefingMarkdown` contains the full updated inventory and the ALFRED bullet;
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
- `source`: `ALFRED vintage macro series`
- `pathAdded`: list of `raw/alfred/...` files or `null`
- `downloadedFiles`
- `rowCounts`
- `fieldCounts`
- `timeCoverage`
- `vintageCoverage`
- `trueVintageDetected`
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
source: ALFRED vintage macro series
path_added: <paths or none>
profile_updated: true|false
recommended_next_action: <one line>
```
