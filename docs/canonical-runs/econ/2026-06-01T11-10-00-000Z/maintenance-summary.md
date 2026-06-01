# CFTC COT Compact Ingestion Summary

- Execution id: `2b030a00-1193-4af9-b87e-803371fd4fa6`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/2b030a00-1193-4af9-b87e-803371fd4fa6`
- Final execution status: `failed`
- Failure: remote-agent status-file rename failed after the worker wrote its final result: `[Errno 2] No such file or directory: '/results/2b030a00-1193-4af9-b87e-803371fd4fa6/.remote-agent/state/status.json.tmp' -> '/results/2b030a00-1193-4af9-b87e-803371fd4fa6/.remote-agent/state/status.json'`

## Useful Output Observed

The worker downloaded and measured the compact CFTC Commitments of Traders slice before the wrapper failure:

- `raw/cftc_cot/fut_disagg_txt_2026.zip`
  - bytes: `1020038`
  - sha256: `52f6976f122e9b203111138f19dd32fc0b44f7133907e0181ea9388895c74be8`
  - ZIP member: `f_year.txt`
  - uncompressed member bytes: `9190413`
  - rows: `5685`
  - fields: `191`
  - date coverage: `2026-01-06` to `2026-05-26`
  - report type: Disaggregated Futures Only
- `raw/cftc_cot/disaggregated_explanatory_notes.html`
  - bytes: `58088`
  - sha256: `3086f0f9b860ff1218ebcae1108015d8905a97e08fc916edea9c5dff213dc46f`

The local public docs were updated to include the CFTC inventory bullet because the artifact stream and command log show the provider-native files were downloaded and inspected. The backend canonical validator was not treated as successful because the admin execution itself ended in `failed`.

## Follow-Up

Rerun a small CFTC maintenance job if strict canonical validation is required. The rerun should avoid mutating top-level inventory files repeatedly and should copy required artifacts into `/results/<execution-id>/` before final status handling.
