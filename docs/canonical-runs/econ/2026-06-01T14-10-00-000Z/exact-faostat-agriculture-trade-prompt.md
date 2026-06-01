# Econ Compact Ingestion: FAOSTAT Agriculture And Food Systems

You are running an admin-owned canonical dataset improvement for `econ`.

Objective: add one compact, high-value international agriculture and food-systems source family to the econ canonical dataset: official FAOSTAT bulk-download data packages.

Why this source:

- The current coverage roadmap explicitly names international trade, agriculture, and development as missing or incomplete.
- FAOSTAT is a core public source for economists studying agricultural production, food balances, commodity trade, land use, inputs, prices, food security, and structural transformation.
- Official FAOSTAT bulk packages can be stored as a small number of provider-native ZIP/CSV files without expanding archives into many small files.

Dataset and storage constraints:

- Use the mounted dataset directory from `$DATASET_DIR`, `$DATASET_MOUNT_PATH`, or `/data/datasets/econ`.
- Before writing, record `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"`.
- Perform a real write/delete probe in the dataset root before downloads. If it fails, block as `dataset_dir_not_writable` with the exact non-secret filesystem error.
- Do not delete, rename, or modify existing provider-native raw sources.
- Do not touch `.remote-agent/runs`.
- Keep writes scoped to `raw/faostat/` plus required run artifacts/docs/profile updates.
- If `df -i` shows fewer than 20,000 free inodes before writing, block before downloading.
- Use official FAO/FAOSTAT URLs only, such as the public FAOSTAT bulk-download endpoint or official FAOSTAT download pages. Do not use mirrors.
- Prefer compact provider-native ZIP or CSV files. Do not expand archives except transiently in `/tmp` for row/schema inspection when necessary.

Required source work:

1. Create `raw/faostat/`.
2. Discover official FAOSTAT public bulk-download URLs from FAO/FAOSTAT pages or the official bulk-download endpoint.
3. Download a compact initial canonical slice that materially improves economics coverage. Prefer two to four high-value packages if each is reasonably sized:
   - Crops and livestock products / production quantities.
   - Food balances or food security indicators.
   - Producer/consumer prices or commodity price-relevant datasets.
   - Crops/livestock trade where available in a compact official package.
4. If a preferred package is unavailable, gated, too large for this controlled run, or would create many files, record the exact reason and choose the next compact official FAOSTAT package.
5. Preserve files exactly as downloaded under `raw/faostat/`.
6. For each file compute:
   - byte count
   - SHA-256 hash
   - file format
   - row count / worksheet dimensions / archive member inventory without full extraction to the dataset volume
   - year coverage
   - geography coverage
   - main measures and dimensions
7. Record source license/access notes from FAOSTAT/FAO public data context.
8. Record `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"` after writing.

Required profile/docs work:

- Append precise inventory bullets for the new `raw/faostat/` files to:
  - `dataset_briefing.md`
  - `docs/public-datasets/briefings/econ.md`
  - `docs/public-datasets/econ.mdx`
- Preserve the complete existing econ inventory. Do not replace it with a short source-only briefing.
- The new bullets must state why these files improve the international agriculture/trade/development gap, but must not claim the econ dataset has all possible economist data.
- Update the backend dataset profile by POSTing the exact full updated briefing markdown to `POST /api/cli/datasets/econ/profile` if authenticated profile update is available in the worker.
- Read back `GET /api/cli/datasets/econ` and verify:
  - the returned `briefingMarkdown` contains the full updated inventory and every FAOSTAT bullet;
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
- `source`: `FAOSTAT`
- `pathAdded`: list of `raw/faostat/...` files or `null`
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
source: FAOSTAT
path_added: <paths or none>
profile_updated: true|false
recommended_next_action: <one line>
```
