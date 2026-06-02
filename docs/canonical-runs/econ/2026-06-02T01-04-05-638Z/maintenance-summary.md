# Econ SSA/OASDI Public Tables Run

- Dataset: `econ`
- Admin execution id: `de1dbb80-fc32-4fb8-831b-279379264b77`
- Status: blocked by canonical validation
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/de1dbb80-fc32-4fb8-831b-279379264b77`

## Intent

Add one compact official/public Social Security Administration OASDI transfer-system package under `raw/ssa_oasdi_public_tables_<capture-date>/`, preserving provider-native public tables and adding provenance/inventory metadata. The target roadmap gap was SSA/OASDI public transfer-system tables, not restricted claims records or individual-level microdata.

## Outcome

The remote execution reached `ready` and reported seven deliverable artifacts, but canonical validation blocked the run. The worker transcript showed repeated access failures against official SSA public table endpoints, including 403 responses from SSA ZIP/table downloads and unresolved `download.ssa.gov`/`ftp.ssa.gov` fallback hosts. The run also left the captured `dataset_briefing.md` and backend profile briefing as startup placeholders.

Validation blockers reported:

- `dataset_briefing.md` was still the startup placeholder.
- `profile briefingMarkdown` was still the startup placeholder.
- Both the artifact briefing and profile briefing were missing existing Federal Reserve Z.1, World Bank WDI, and BIS CPMI inventory markers.

Because the run failed the full-briefing preservation/readback gate, the public dataset docs were not updated to claim the SSA/OASDI addition as canonical.

## Recovery

After validation failed, the backend econ profile was restored from the checked-in full briefing and tied back to the prior validated disk-proven inventory run `98cb77ed-5fba-4c35-9f7d-37d003628d45`. Readback after restore confirmed the briefing was not a startup placeholder and still included the ONS balance-of-payments, Federal Reserve Z.1, World Bank WDI, and BIS CPMI markers.

## Next Step

Retry this gap only after choosing an SSA source path reachable from the remote worker or selecting an alternate official public transfer-system source such as Treasury/Fiscal Data or CMS summary tables. The retry must regenerate `dataset_briefing.md` from the full current inventory and avoid profile updates until placeholder checks pass.
