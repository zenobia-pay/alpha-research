# Econ BEA Regional Local-Area Run

- Dataset: `econ`
- Admin execution id: `00486c4b-5624-4e6e-88ee-a868a74101a9`
- Status: blocked by canonical validation
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/00486c4b-5624-4e6e-88ee-a868a74101a9`

## Intent

Add one compact official/public U.S. Bureau of Economic Analysis regional/local-area package under `raw/bea_regional_local_area_<capture-date>/`, preserving provider-native BEA files and adding provenance/inventory metadata.

## Outcome

The remote execution reached `ready` and downloaded BEA files under `raw/bea_regional_local_area_20260602`, but canonical validation blocked the run because the final briefing and profile were narrow and dropped required existing econ inventory markers.

Artifact evidence showed these provider-native ZIPs landed:

- `CAINC30.zip`: 23,503,703 bytes; SHA-256 `29945d32e31ef53e03907d282016156bcb946705583a9f8790d687d7da1bba63`; contains `CAINC30__ALL_AREAS_1969_2024.csv` with 73,811 rows and 64 columns covering county/MSA personal-income components, annual 1969-2024, current dollars.
- `CAEMP25N.zip`: 11,050,299 bytes; SHA-256 `b36723a57080fce5a1020e63f898f2ceaa35d06bb01a454d4f643722cf6dca6b`; contains `CAEMP25N__ALL_AREAS_2001_2022.csv` with 104,878 rows and 30 columns covering county employment counts, annual 2001-2022, persons.

The artifact `improvement_result.json` reported `status: "in_progress"` rather than completed. Candidate source notes also indicated some BEA links such as `CAINC20`, `CA25`, and `CA25N` returned HTML gating and remain pending.

Validation blockers reported:

- `dataset_briefing.md` was missing existing Federal Reserve Z.1, World Bank WDI, and BIS CPMI inventory markers.
- `profile briefingMarkdown` was missing the same existing inventory markers.

Because the run failed the full-briefing preservation/readback gate, the public dataset docs were not updated to claim the BEA regional/local-area addition as canonical in this commit.

## Recovery

After validation failed, the backend econ profile was restored from the checked-in full briefing and tied back to the prior validated disk-proven inventory run `98cb77ed-5fba-4c35-9f7d-37d003628d45`. Readback after restore confirmed the briefing was not a startup placeholder and still included the Federal Reserve Z.1, World Bank WDI, and BIS CPMI markers.

## Follow-Up Fix

This run exposed a validator gap: explicit `improvement_result.json` statuses other than `"completed"` should not validate. The canonical validator was updated after this run to block any explicit non-completed result status, including `"in_progress"`.

## Next Step

Launch a focused repair/briefing-refresh run for `raw/bea_regional_local_area_20260602` that does not redownload the source, regenerates a full inventory from the current volume, and validates only after the artifact briefing preserves all existing inventory markers.
