# IRS SOI Public Finance Ingestion Summary

- Execution id: `aa0f6dc6-b6b4-4eac-b9a7-d039d64b9647`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/aa0f6dc6-b6b4-4eac-b9a7-d039d64b9647`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/aa0f6dc6-b6b4-4eac-b9a7-d039d64b9647/artifacts`
- Final execution status: `ready`
- Validation status: `blocked`

## What Landed

The worker passed disk/inode checks and a write/delete probe, then added:

- `raw/irs_soi/zipcode2022.zip`
- `raw/irs_soi/22zpdoc.docx`

The IRS SOI ZIP-code package is the Tax Year 2022 individual income tax package from official IRS URLs. The artifact stream reports:

- 51 state Excel workbooks in the provider ZIP.
- National CSV summaries `22zpallagi.csv` and `22zpallnoagi.csv`.
- 166,131 ZIP-AGI rows in the AGI summary.
- 27,690 ZIP rows in the non-AGI summary.
- 165 columns covering returns, AGI, taxable income, credits, deductions, and preparation indicators.
- Geography: United States ZIP codes.
- Time coverage: Tax Year 2022.

## Validation Result

`npm run canonical:dataset -- validate --dataset-id econ --execution-id aa0f6dc6-b6b4-4eac-b9a7-d039d64b9647` blocked even though the execution reached `ready` and promoted the four primary artifacts. Blockers:

- `dataset_briefing.md` artifact was too short and omitted required existing econ markers including `raw/federal_reserve_z1/z1_csv_files_20260319.zip` and `raw/worldbank/WDI_CSV_2026_04_09.zip`.
- Backend profile readback still pointed to prior run `4822354c-5587-421f-b0e6-b8616d6c6e99`.

The docs mirror artifact did preserve the broader inventory, so the checked-in public docs were updated with the IRS SOI bullet. The canonical backend profile was not treated as validated from this run.

## Follow-Up

Repair the remote worker's `dataset_briefing.md` generation so the promoted primary briefing preserves the complete econ inventory, not only the newest additions and recent repair bullets. After that, run a profile-sync or source-ingestion job that updates backend profile proof to the new execution id.
