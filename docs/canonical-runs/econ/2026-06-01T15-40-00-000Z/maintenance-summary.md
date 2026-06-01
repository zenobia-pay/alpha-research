# CFPB Consumer Complaint Database Attempt

- Execution id: `86411dd5-92b2-4be1-9d49-e2d66346fb51`
- Dataset id: `econ`
- Status: failed canonical artifact gate
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/86411dd5-92b2-4be1-9d49-e2d66346fb51`

## Result

The remote execution downloaded the official CFPB Consumer Complaint Database bulk ZIP from `https://files.consumerfinance.gov/ccdb/complaints.csv.zip` and landed it on the canonical dataset volume at:

- `raw/cfpb_complaints/complaints.csv.zip`

The provider ZIP is 1,857,457,179 bytes with SHA-256 `bc2720b586dd36e6527f3aed11aa5698085b74713f0363299328e62d926e66a9`. It contains `complaints.csv` with about 8,885,747,179 uncompressed bytes, 15,536,997 complaint rows, and 18 fields spanning 2011-12-01 to 2026-05-30.

Fields cover complaint date and ID, consumer financial product/sub-product, issue/sub-issue, company, state/ZIP geography, submission channel, company response, timely response, dispute flag, and optional consumer narrative/consent fields. The source expands U.S. credit, mortgage, debt-collection, and consumer-finance coverage.

## Validation Note

The execution failed with `Remote agent run completed without required primary artifact: dataset_briefing.md`. The data appears to be present on the volume, but the failed execution was not accepted as canonical validation. A follow-up profile-sync repair is required to promote the updated public briefing and volume inventory proof.
