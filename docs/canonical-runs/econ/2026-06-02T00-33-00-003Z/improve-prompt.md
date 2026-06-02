Canonical admin repair/verification job for dataset `econ`: verify and finalize the ONS regional accounts package that prior execution `ca30075c-6c4c-43a7-b84d-8aa482f80645` appears to have landed under `raw/ons_regional_accounts_gva_balanced_20260602/`.

Scope:
- This is an admin-owned canonical dataset improvement/repair job, not a user-facing research analysis run.
- Use the mounted canonical dataset volume, preferably `DATASET_MOUNT_PATH`.
- Before profile edits, perform an actual create/write/delete probe in the dataset root. If the probe fails, stop and report `dataset_dir_not_writable` with the exact non-secret filesystem error.
- Do not redownload broad ONS catalogs. First inspect `raw/ons_regional_accounts_gva_balanced_20260602/`.
- If the directory or provider workbook is absent, block and leave the profile unchanged.
- If present, compute fresh file facts from disk and repair the canonical inventory/profile from those facts.

Required source facts:
- Inspect `regionalgrossvalueaddedbalancedperheadandincomecomponents.xlsx` and compute byte count and SHA-256 from the actual file.
- Inspect local `metadata.json`, `sheet_summary.json`, `sheet_summary.csv`, `raw_inventory.jsonl`, and `raw_inventory.csv` if present.
- If any metadata is missing or stale, regenerate small metadata/inventory files in the same raw directory.
- For the workbook, report sheet count, sheet names, row/column counts, visible time coverage, geography coverage, units, and key concepts. Prior transcript evidence suggests Table 1 starts with `ITL`, `ITL code`, `Region name`, and annual columns starting 1998.
- Preserve provider-native files. Do not create merged panels, derived fields, cross-source joins, normalized analytical tables, or analysis-ready artifacts.

Required artifacts:
- `dataset_briefing.md`: a full updated dataset inventory briefing that preserves all prior inventory bullets and adds the ONS regional accounts entry near the top.
- `improvement_result.json`: structured result with dataset id, raw directory, files, hashes, row/sheet counts, source URLs, license, and limitations.
- `raw_inventory.jsonl` and `raw_inventory.csv`: file-level inventory for the verified package.
- `candidate_sources.csv`: include the selected ONS regional GVA source and note the prior blocked execution.
- `work.md`: concise execution notes, including write-probe result and repaired/verified files.
- Updated docs mirrors for `docs/public-datasets/briefings/econ.md` and `docs/public-datasets/econ.mdx`.

Profile/readback:
- Update the canonical dataset profile/briefing to the full updated inventory, not a narrow briefing that drops older entries.
- Read the profile back after update and verify it remains `disk_proven`, `writeReady: true`, and tied to this repair execution id.
- Preserve roadmap limitation language. Mark ONS regional accounts as present in part only if the workbook is verified from disk; do not claim full ONS regional coverage, Blue Book/Pink Book revision histories, or full ONS API/catalog completion.

Slack/status:
- Keep any Slack briefing concise and non-secret. Do not include tokens, webhook URLs, auth headers, or secret material.
