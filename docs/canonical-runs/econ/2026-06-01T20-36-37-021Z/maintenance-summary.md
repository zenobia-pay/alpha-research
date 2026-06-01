# Treasury DTS Operating Cash Addition

- Admin execution: `1f93facc-c2fa-4479-955c-61d0f75e1be9`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/1f93facc-c2fa-4479-955c-61d0f75e1be9`
- Target mounted path: `/data/datasets/econ/raw/treasury_fiscal_dts_operating_cash_20260601/`
- Final remote status: `ready`
- Canonical validator status before repair: blocked.

The execution completed the raw Treasury FiscalData Daily Treasury Statement deposits/withdrawals ingest but failed the canonical final-artifact gate: captured `dataset_briefing.md` and `improvement_result.json` remained the startup placeholders. The backend profile was therefore repaired from the checked-in full briefing plus verified run artifacts rather than from the bad final briefing artifact.

Verified evidence from delivered artifacts:

- `download_inventory_summary.json`: 47 CSV pages, 469,329 rows, 94,947,625 bytes, 2026-05-29 back through 2005-10-03.
- `volume_inventory_summary.json`: same 47-page, 469,329-row, 94,947,625-byte volume evidence.
- `data_dictionary.md`: records `raw/treasury_fiscal_dts_operating_cash_20260601/` with provider-native `page_0001.csv` through `page_0047.csv`, `metadata.json`, and `inventory.csv`.
- Local source probe before launch confirmed FiscalData metadata `total-count = 469329`; page 47 was a short final page with 9,329 data rows plus header.

Post-run repair:

- Added a literal checked-in inventory bullet for `raw/treasury_fiscal_dts_operating_cash_20260601/`.
- Regenerated `docs/public-datasets/econ.mdx` from the repaired briefing.
- Updated the backend econ profile to the repaired full briefing with `volumeInventoryRunId` and `describedRunId` set to this execution id.

The repair makes the DTS operating-cash data discoverable while preserving the audit fact that the immutable run-collected briefing artifact remained invalid.
