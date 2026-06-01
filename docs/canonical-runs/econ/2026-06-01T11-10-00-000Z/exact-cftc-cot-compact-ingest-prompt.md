# Econ Compact Ingestion: CFTC Commitments of Traders

You are running an admin-owned canonical dataset improvement for `econ`.

Objective: add one compact, high-value provider-native financial-markets source to the econ canonical dataset: Commodity Futures Trading Commission Commitments of Traders (COT) historical compressed files.

Why this source:

- It fills the roadmap gap for financial markets, commodity futures, trader positioning, and market-structure evidence.
- It is an official public government source.
- It can be stored as compact provider-native compressed files to avoid a new inode explosion.

Dataset and storage constraints:

- Use the mounted dataset directory from `$DATASET_DIR`, `$DATASET_MOUNT_PATH`, or `/data/datasets/econ`.
- Before writing, record `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"`.
- Do not expand archives into thousands of files. Preserve provider-native ZIP/text/CSV packages as compact raw files.
- Do not delete, rename, or modify existing provider-native raw sources.
- Do not touch `.remote-agent/runs`.
- Keep writes scoped to `raw/cftc_cot/` plus required run artifacts.
- If `df -i` shows fewer than 20,000 free inodes before writing, block before downloading.

Required source work:

1. Use the official CFTC Historical Compressed COT page as the source catalog:
   - `https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm`
2. Download a compact initial canonical slice under `raw/cftc_cot/`:
   - Prefer the latest available annual "Disaggregated Futures Only" text or CSV compressed file.
   - Also download the CFTC explanatory note or field documentation when available.
   - If the exact latest-year link is difficult to derive, use the CFTC page to discover the exact provider URL and record it. Do not use unofficial mirrors.
3. Preserve files exactly as downloaded.
4. Compute byte counts and SHA-256 hashes for each downloaded file.
5. Inspect archive/file structure without full expansion:
   - list ZIP members or first/header rows only;
   - count rows by streaming if practical;
   - record field names, date coverage, report type, market/entity dimensions, and units/measures.
6. Record source license/access notes from CFTC public page context.
7. Record `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"` after writing.

Required profile/docs work:

- Append a precise inventory bullet for the new `raw/cftc_cot/` files to:
  - `dataset_briefing.md`
  - `docs/public-datasets/briefings/econ.md`
  - `docs/public-datasets/econ.mdx`
- Preserve the complete existing econ inventory. Do not replace it with a short source-only briefing.
- Update the backend dataset profile by POSTing the exact full updated briefing markdown to `POST /api/cli/datasets/econ/profile` if authenticated profile update is available in the worker. If the worker profile update fails, record the exact non-secret failure in `improvement_result.json`; the local maintainer will sync profile after artifact inspection.

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
- `source`: `Commodity Futures Trading Commission Commitments of Traders`
- `pathAdded`: `raw/cftc_cot/...`
- `downloadedFiles`
- `rowCounts`
- `fieldCounts`
- `timeCoverage`
- `reportTypes`
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
source: CFTC Commitments of Traders
path_added: <path or none>
profile_updated: true|false
recommended_next_action: <one line>
```
