# Exact Prompt

Dataset id: `econ`

Objective: repair the econ canonical dataset profile and public briefing inventory after the CFPB Consumer Complaint Database ZIP landed in execution `86411dd5-92b2-4be1-9d49-e2d66346fb51` but that execution failed the primary-artifact gate.

Do not download new data and do not expand large provider ZIPs. This is a profile/documentation synchronization and proof pass only.

Required existing source markers:

- `raw/cfpb_complaints/complaints.csv.zip`
- `raw/cftc_cot/fut_disagg_txt_2026.zip`
- `raw/alfred/GDP_alfred.csv`
- `raw/irs_soi/zipcode2022.zip`
- `raw/faostat/Production_Crops_Livestock_E_All_Data_Normalized.zip`

Tasks:

1. Confirm the required existing source markers are present on `/data/datasets/econ`.
2. Confirm `raw/cfpb_complaints/complaints.csv.zip` is the provider ZIP from `https://files.consumerfinance.gov/ccdb/complaints.csv.zip`.
3. Update `/data/datasets/econ/dataset_briefing.md` and `/data/datasets/econ/docs/public-datasets/briefings/econ.md` so they contain a precise CFPB inventory bullet with these facts:
   - provider ZIP path: `raw/cfpb_complaints/complaints.csv.zip`
   - ZIP bytes: `1,857,457,179`
   - SHA-256: `bc2720b586dd36e6527f3aed11aa5698085b74713f0363299328e62d926e66a9`
   - member: `complaints.csv`
   - uncompressed bytes: about `8,885,747,179`
   - row count: `15,536,997`
   - field count: `18`
   - date span: `2011-12-01` to `2026-05-30`
   - coverage: U.S. states and territories with ZIP fields where reported
   - subject coverage: consumer financial complaints by product/sub-product, issue/sub-issue, company, geography, submission channel, response, timeliness, dispute flag, complaint ID, and optional narrative/consent fields.
4. Preserve the roadmap language that the econ dataset is broad but not a completed claim that every economist need is already covered.
5. Emit required primary artifact `dataset_briefing.md` in the result artifacts.
6. Update the canonical dataset profile so `diskInventoryProven` is true and `volumeInventoryRunId` points to this profile-sync execution id.

Return JSON with:

- `status`
- `datasetId`
- `profileUpdated`
- `requiredMarkersPresent`
- `cfpbPath`
- `cfpbRows`
- `cfpbZipBytes`
- `cfpbSha256`
- `datasetBriefingArtifactWritten`
- `notes`
