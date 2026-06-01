# Treasury FiscalData Public Finance Attempt

- Admin execution: `5ae066ac-d014-4488-a8cb-b99b63af5b70`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/5ae066ac-d014-4488-a8cb-b99b63af5b70`
- Target mounted path: `/data/datasets/econ/raw/fiscaldata_treasury_public_finance_20260601/`
- Final run status: blocked.

The run proved the mounted dataset root was writable and fetched some official FiscalData CSV pages, but it did not satisfy the canonical completion contract. Its captured `dataset_briefing.md` remained the startup placeholder, `improvement_result.json` reported blocked, and backend validation rejected the execution.

Verified useful source evidence from execution artifacts:

- `debt_to_penny`: 1 page, 8,318 rows, 819,064 bytes.
- `avg_interest_rates`: 1 page, 4,945 rows, 497,876 bytes.
- `auctions_query`: 2 pages, 10,988 rows, 11,015,826 bytes.
- `dts_deposits_withdrawals_operating_cash`: pages 1-11 were individually observed with 10,000 rows per page and the header `record_date,account_type,transaction_type,transaction_catg,transaction_catg_desc,transaction_today_amt,transaction_mtd_amt,transaction_fytd_amt,table_nbr,table_nm,src_line_nbr,record_fiscal_year,record_fiscal_quarter,record_calendar_year,record_calendar_quarter,record_calendar_month,record_calendar_day`, but no reliable final-page proof was captured.

Because the existing checked-in inventory already contains the completed `raw/treasury_fiscal_debt_auctions_20260601/` FiscalData debt, average-rate, and auction package, this blocked run was not promoted as a new completed dataset bullet. The backend econ profile was repaired after the run to restore the full checked-in briefing and to point `volumeInventoryRunId` back to the latest complete disk-proven inventory run, `b4a0cb4b-6773-42b4-a9ae-3494f9e5e92c`, while recording this blocked execution as `profileSyncRepairRunId`.

Next action: if Daily Treasury Statement operating-cash coverage is still desired, launch a narrower canonical job only for `dts_deposits_withdrawals_operating_cash`, require metadata-based total page count or final short-page proof, and do not update the profile unless the full pagination manifest and final briefing artifact are present.
