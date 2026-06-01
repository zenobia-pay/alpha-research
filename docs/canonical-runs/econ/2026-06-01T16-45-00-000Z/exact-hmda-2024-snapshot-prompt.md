# Exact Prompt

Dataset id: `econ`

Objective: add one high-value mortgage-credit source family to the econ canonical dataset: official FFIEC/CFPB Home Mortgage Disclosure Act (HMDA) 2024 Snapshot National Loan-Level Dataset files.

This is a canonical admin-owned dataset improvement job. Do not start a user-facing research run. Keep writes scoped to `raw/hmda_2024_snapshot/` plus required run artifacts, inventories, docs, and profile updates.

Use only official FFIEC/CFPB public URLs:

- `https://files.ffiec.cfpb.gov/static-data/snapshot/2024/2024_public_lar_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2024/2024_public_ts_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2024/2024_public_msamd_csv.zip`
- landing page for context: `https://ffiec.cfpb.gov/data-publication/snapshot-national-loan-level-dataset/2024`

Do not use third-party mirrors. If the official file server is unavailable or returns non-ZIP content, stop and report the exact HTTP status, URL, response content type, and blocker.

Requirements:

1. Create `raw/hmda_2024_snapshot/`.
2. Run an actual write probe in `/data/datasets/econ` before downloads.
3. Download the three official provider ZIP files above into `raw/hmda_2024_snapshot/`.
4. Preserve the provider ZIP files exactly as downloaded. Do not expand the large LAR ZIP into persistent extracted files.
5. For each ZIP, record:
   - source URL
   - dataset path
   - byte size
   - SHA-256
   - ZIP member names
   - uncompressed byte sizes
6. For `2024_public_lar_csv.zip`, stream-inspect the CSV member without extracting it permanently and record:
   - row count excluding header
   - field count
   - header names
   - year/freeze date context from the landing page or embedded metadata if available
   - geography fields and covered mortgage-credit dimensions
7. For companion files, record row counts and field counts if cheap to stream.
8. Update inventories/download events on the mounted volume using the repo's existing canonical conventions.
9. Append a precise inventory bullet for `raw/hmda_2024_snapshot/` to:
   - `/data/datasets/econ/dataset_briefing.md`
   - `/data/datasets/econ/docs/public-datasets/briefings/econ.md`
   - `/data/datasets/econ/docs/public-datasets/econ.mdx` if present
10. Preserve the roadmap language that the econ dataset is broad but not a completed claim that every economist need is already covered.
11. Update the canonical dataset profile so `diskInventoryProven` is true and `volumeInventoryRunId` points to this execution id.
12. Emit the required primary artifacts into the result directory:
   - `dataset_briefing.md`
   - `improvement_result.json`
   - `work.md`
   - `report.html`

The inventory bullet should explain that HMDA supplies loan/application-level public mortgage data, including action taken, loan purpose/type, occupancy, lien status, loan amount, income, race/ethnicity/sex/age fields, census tract, county/MSA/state geography, debt-to-income, loan-to-value, interest rate, points/fees, lender/institution identifiers available in the public files, and privacy modifications.

Return JSON with:

- `status`
- `datasetId`
- `sourceFamily`
- `pathAdded`
- `files`
- `larRows`
- `larFields`
- `profileUpdated`
- `datasetBriefingArtifactWritten`
- `notes`
