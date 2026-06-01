# Econ Compact Ingestion: CFPB Consumer Finance Complaints

You are running an admin-owned canonical dataset improvement for `econ`.

Objective: add one compact, high-value consumer-credit and consumer-finance source family to the econ canonical dataset: official Consumer Financial Protection Bureau consumer complaint database bulk data.

Why this source:

- The current coverage roadmap explicitly names CFPB complaint and consumer-credit datasets as missing or incomplete.
- CFPB complaints are a core public source for economists studying consumer finance, credit markets, mortgage and debt-collection frictions, financial inclusion, product-level complaints, institutions, geography, and time-series stress signals.
- The public CFPB complaint database is available as an official bulk CSV/ZIP artifact that can be stored provider-native without expanding into many files.

Dataset and storage constraints:

- Use the mounted dataset directory from `$DATASET_DIR`, `$DATASET_MOUNT_PATH`, or `/data/datasets/econ`.
- Before writing, record `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"`.
- Perform a real write/delete probe in the dataset root before downloads. If it fails, block as `dataset_dir_not_writable` with the exact non-secret filesystem error.
- Do not delete, rename, or modify existing provider-native raw sources.
- Do not touch `.remote-agent/runs`.
- Keep writes scoped to `raw/cfpb_complaints/` plus required run artifacts/docs/profile updates.
- If `df -i` shows fewer than 20,000 free inodes before writing, block before downloading.
- Use official CFPB URLs only, such as `https://files.consumerfinance.gov/ccdb/complaints.csv.zip` or official CFPB complaint database download pages. Do not use mirrors.
- Preserve the downloaded provider-native ZIP. Do not expand it on the dataset volume.

Required source work:

1. Create `raw/cfpb_complaints/`.
2. Discover and verify the official CFPB bulk-download URL and any official metadata/data-dictionary page available from CFPB.
3. Download the official complaints bulk CSV ZIP and, if compact, official metadata or data dictionary documentation.
4. Preserve files exactly as downloaded under `raw/cfpb_complaints/`.
5. For each file compute:
   - byte count
   - SHA-256 hash
   - file format
   - archive member inventory
   - row count or observation count without full extraction to the dataset volume
   - date coverage
   - geography coverage
   - main measures and dimensions
6. Record source license/access notes from official CFPB public data context.
7. Record `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"` after writing.

Required profile/docs work:

- Append a precise inventory bullet for the new `raw/cfpb_complaints/` files to:
  - `dataset_briefing.md`
  - `docs/public-datasets/briefings/econ.md`
  - `docs/public-datasets/econ.mdx`
- Preserve the complete existing econ inventory. Do not replace it with a short source-only briefing.
- The new bullet must state why these files improve the credit, consumer-finance, and financial-market gap, but must not claim the econ dataset has all possible economist data.
- Update the backend dataset profile by POSTing the exact full updated briefing markdown to `POST /api/cli/datasets/econ/profile` if authenticated profile update is available in the worker.
- Read back `GET /api/cli/datasets/econ` and verify:
  - the returned `briefingMarkdown` contains the full updated inventory and the CFPB bullet;
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
- `source`: `CFPB Consumer Complaint Database`
- `pathAdded`: list of `raw/cfpb_complaints/...` files or `null`
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
source: CFPB Consumer Complaint Database
path_added: <paths or none>
profile_updated: true|false
recommended_next_action: <one line>
```
