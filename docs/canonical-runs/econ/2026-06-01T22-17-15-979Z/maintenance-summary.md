# Econ Canonical Run Maintenance Summary

- Dataset: `econ`
- Execution id: `c984a1c5-9bdc-48f5-95f2-5fb234e2295f`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/c984a1c5-9bdc-48f5-95f2-5fb234e2295f`
- Outcome: blocked, no SSA/OASDI data landed.
- Blocker: official SSA endpoints for the targeted Annual Statistical Supplement, OASDI state/county, OASDI ZIP, monthly OASDI average benefit, and SSA open-data catalog returned Akamai `403 Access Denied` HTML payloads from the runner egress.
- Dataset profile repair: backend profile was restored from the checked-in full econ briefing after the blocked run wrote a narrow blocked-run briefing.
- Current inventory implication: `SSA/OASDI tables` remains an explicit public finance and transfer-system gap in the econ roadmap.
