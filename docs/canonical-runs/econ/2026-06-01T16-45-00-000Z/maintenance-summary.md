# HMDA 2024 Snapshot Addition

- Execution id: `f8e4ec4d-7627-4fd1-83dc-ece432f0cba2`
- Dataset id: `econ`
- Status: remote execution ready; initial validation blocked on stale backend profile readback until explicit profile sync
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/f8e4ec4d-7627-4fd1-83dc-ece432f0cba2`

## Result

The remote execution downloaded official FFIEC/CFPB HMDA 2024 Snapshot National Loan-Level Dataset files into:

- `raw/hmda_2024_snapshot/2024_public_lar_csv.zip`
- `raw/hmda_2024_snapshot/2024_public_ts_csv.zip`
- `raw/hmda_2024_snapshot/2024_public_msamd_csv.zip`

Source URLs:

- `https://files.ffiec.cfpb.gov/static-data/snapshot/2024/2024_public_lar_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2024/2024_public_ts_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2024/2024_public_msamd_csv.zip`
- Landing page: `https://ffiec.cfpb.gov/data-publication/snapshot-national-loan-level-dataset/2024`

Inventory captured from the remote artifacts:

- LAR ZIP: 664,242,987 bytes, SHA-256 `9383890f38c2ae1ef46942e72e1a2a211aa0b979c0e46db5fd6d7eb8669f22c1`, member `2024_public_lar_csv.csv`, 12,229,298 loan/application rows, 99 fields.
- TS ZIP: 199,079 bytes, SHA-256 `da0467f5b3168549cd265fd0d1ec32c5015e5f67559507220bdf45d3bcf5bf4f`, 4,908 transmittal-sheet rows, 10 fields.
- MSA/MD ZIP: 6,063 bytes, SHA-256 `a7ab89a95acc28cd383be9f889b5ff068586accff22612f86595f95d4f0ede73`, 418 MSA/MD lookup rows.

HMDA fills a major mortgage-credit roadmap gap with public loan/application-level data covering action taken, loan purpose/type, occupancy, lien status, loan amount, income, borrower demographics, census tract/county/MSA/state geography, debt-to-income, loan-to-value, interest rate, points/fees, automated underwriting, lender identifiers, and public privacy modifications.

## Validation Note

The execution produced required artifacts, but the first canonical validation attempt was blocked because backend profile readback still pointed to prior profile proof `a0db8dd0-10ab-4a61-b72b-d9d4612dedb2`. The checked-in briefing was updated locally and the backend profile must be explicitly synchronized to `f8e4ec4d-7627-4fd1-83dc-ece432f0cba2` before final validation.
