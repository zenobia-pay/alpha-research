# Econ Canonical Maintenance Summary

- Dataset: `econ`
- Execution: `4fec9e41-3e60-4f19-bcb0-7adf7856e5bf`
- Admin status: https://alpharesearch.nyc/api/admin/remote-agent-executions/4fec9e41-3e60-4f19-bcb0-7adf7856e5bf
- Prompt record: `docs/canonical-runs/econ/2026-06-02T00-33-28-977Z/improve-prompt.md`
- Validation: blocked.

This repair run attempted to verify the regional accounts package left by execution `ca30075c-6c4c-43a7-b84d-8aa482f80645`. It confirmed the raw directory and workbook on the mounted volume and generated intermediate evidence for `regionalgrossvalueaddedbalancedperheadandincomecomponents.xlsx`: 3,383,231 bytes; SHA-256 `b6048c8fca7140702b23cc18dc2faaf15c50ac031c244e87217e4a10e63b7463`; 20 sheets; annual 1998-2023 coverage; ITL1/ITL2/ITL3 geography. The execution nevertheless failed with `Remote agent run completed without required primary artifact: dataset_briefing.md`.

Canonical validation blocked the run because required primary artifacts (`dataset_briefing.md`, `improvement_result.json`, `work.md`, `report.html`) were missing from the captured artifact set and profile readback remained tied to the prior successful run `98cb77ed-5fba-4c35-9f7d-37d003628d45`. Public docs/profile were intentionally left unchanged from the last validated inventory.
