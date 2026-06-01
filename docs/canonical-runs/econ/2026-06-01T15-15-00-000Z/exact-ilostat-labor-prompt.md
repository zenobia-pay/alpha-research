# Econ Compact Ingestion: ILOSTAT Labor And Employment

You are running an admin-owned canonical dataset improvement for `econ`.

Objective: add a compact, high-value international labor-market source family to the econ canonical dataset: official ILOSTAT public data packages or API extracts.

Why this source:

- The current coverage roadmap explicitly names ILOSTAT and richer international labor data as missing or incomplete.
- ILOSTAT is a core public source for economists studying labor force participation, employment, unemployment, wages, hours, informality, demographics, and country-level labor-market structure.
- Official ILOSTAT bulk/API outputs can be stored as a small number of provider-native CSV/ZIP files without expanding archives into many small files.

Dataset and storage constraints:

- Use the mounted dataset directory from `$DATASET_DIR`, `$DATASET_MOUNT_PATH`, or `/data/datasets/econ`.
- Before writing, record `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"`.
- Perform a real write/delete probe in the dataset root before downloads. If it fails, block as `dataset_dir_not_writable` with the exact non-secret filesystem error.
- Do not delete, rename, or modify existing provider-native raw sources.
- Do not touch `.remote-agent/runs`.
- Keep writes scoped to `raw/ilostat/` plus required run artifacts/docs/profile updates.
- If `df -i` shows fewer than 20,000 free inodes before writing, block before downloading.
- Use official ILO/ILOSTAT URLs only, such as official ILOSTAT bulk-download files, SDMX/API endpoints, or official ILOSTAT download pages. Do not use mirrors.
- Prefer compact provider-native CSV/ZIP files. Do not expand archives on the dataset volume.

Required source work:

1. Create `raw/ilostat/`.
2. Discover official ILOSTAT public bulk or API URLs from ILO/ILOSTAT documentation or endpoints.
3. Download a compact initial canonical slice that materially improves economist coverage. Prefer two to four high-value datasets if each is reasonably sized:
   - Labor force participation / employment / unemployment by sex and age.
   - Employment by sector or occupation.
   - Wages or hours worked if available as compact official series.
   - Informality or working poverty indicators if available as compact official series.
4. If a preferred package is unavailable, gated, too large for this controlled run, or would create many files, record the exact reason and choose the next compact official ILOSTAT package.
5. Preserve files exactly as downloaded under `raw/ilostat/`.
6. For each file compute:
   - byte count
   - SHA-256 hash
   - file format
   - row count or observation count without full extraction to the dataset volume
   - year coverage
   - geography coverage
   - main labor measures and dimensions
7. Record source license/access notes from official ILOSTAT context.
8. Record `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"` after writing.

Required profile/docs work:

- Append precise inventory bullets for the new `raw/ilostat/` files to:
  - `dataset_briefing.md`
  - `docs/public-datasets/briefings/econ.md`
  - `docs/public-datasets/econ.mdx`
- Preserve the complete existing econ inventory. Do not replace it with a short source-only briefing.
- The new bullets must state why these files improve the international labor/development gap, but must not claim the econ dataset has all possible economist data.
- Update the backend dataset profile by POSTing the exact full updated briefing markdown to `POST /api/cli/datasets/econ/profile` if authenticated profile update is available in the worker.
- Read back `GET /api/cli/datasets/econ` and verify:
  - the returned `briefingMarkdown` contains the full updated inventory and every ILOSTAT bullet;
  - `profile.quality.diskInventoryProven` is `true`;
  - `profile.quality.volumeInventoryRunId` equals this execution id;
  - `describedRunId` equals this execution id.
- If profile update/readback fails, record the exact non-secret failure in `improvement_result.json`; still promote full artifacts so the external orchestrator can sync profile proof.

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
- `source`: `ILOSTAT`
- `pathAdded`: list of `raw/ilostat/...` files or `null`
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
source: ILOSTAT
path_added: <paths or none>
profile_updated: true|false
recommended_next_action: <one line>
```
