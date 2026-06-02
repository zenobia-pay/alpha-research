# Econ CalCFI Repair

Objective: repair the empty `raw/calcfi` directory by landing a compact, valid public California fiscal, local-government finance, state budget, tax, revenue, expenditure, debt, or closely related California public-finance source package, then produce canonical inventory artifacts for docs/profile synchronization.

Context:
- This is an admin-owned canonical dataset maintenance job for dataset `econ`.
- Prior read-only inspection found `/data/datasets/econ/raw/calcfi` exists but is empty; local prompt record is `docs/canonical-runs/econ/2026-06-02T02-47-51Z/calcfi-readonly-inspection-prompt.md`.
- Do not use user-facing research run paths. Work only on the mounted canonical dataset volume.

Constraints:
- Use the mounted dataset path from `DATASET_MOUNT_PATH` if set, otherwise `/data/datasets/econ`.
- Before writing under the dataset directory, perform an actual create/write/delete probe in the dataset root or `raw/calcfi`; if it fails, stop with blocker `dataset_dir_not_writable` and the non-secret filesystem error.
- Land only raw/provider-native public source files and small local metadata/inventory helpers. Do not create merged panels, derived columns, joined analytics, or analysis-ready transformations.
- Prefer official California sources: California State Controller local government finance data, California Department of Finance budget/fiscal tables, California open-data portal datasets, Legislative Analyst's Office data tables, or other official state public-finance endpoints. If a CalCFI-branded source cannot be found, a closely related official California fiscal dataset may be landed only if clearly labeled conservatively.
- Keep the repair compact and bounded. Avoid broad recursive crawls, browser-only scraping, or pages requiring session/captcha/credential access.
- Preserve provider terms/attribution caveats. Do not include secrets or credentials in artifacts.
- Do not leave HTML error pages, redirects, AccessDenied XML, or startup placeholders as promoted data.

Required work:
1. Create or reuse `raw/calcfi`.
2. Locate an official public California fiscal/public-finance data source.
3. Download the provider-native file(s) into `raw/calcfi`.
4. Validate each landed file:
   - HTTP status/final URL where applicable;
   - byte size and SHA-256;
   - content type/signature check so HTML/XML error bodies are rejected unless HTML/PDF is explicitly the provider-native public report format;
   - schema/header fields for CSV/XLSX/JSON;
   - row counts and sample values;
   - time/geography/measure coverage where feasible.
5. Write canonical artifacts in the execution workspace:
   - `manifest.json`
   - `source_registry.csv`
   - `source_registry.plan.json`
   - `download_inventory.jsonl`
   - `download_inventory.csv`
   - `download_events.jsonl`
   - `slack_download_alerts.jsonl`
   - `slack_briefing.md`
   - `raw_inventory.jsonl`
   - `raw_inventory.csv`
   - `volume_inventory.jsonl`
   - `volume_inventory.csv`
   - `volume_inventory_summary.json`
   - `volume_tree.txt`
   - `data_dictionary.md`
   - `quality_report.md`
   - `dataset_briefing.md`
   - `improvement_result.json`
   - `work.md`
   - `report.html`
6. If valid files are landed, update the dataset briefing/docs mirror with a conservative `raw/calcfi/` inventory entry including file names, sizes, hashes, row counts, provider, coverage, terms caveat, and limitations.
7. If no valid California fiscal source can be landed, do not promote the empty directory as coverage. Record the exact blocker and keep `raw/calcfi` documented as absent/empty.
8. Update the canonical econ profile only after the real disk inventory is proven. Profile readback must remain `disk_proven`, `diskInventoryProven: true`, and must not contain startup placeholder text.

Success criteria:
- `raw/calcfi` contains one or more real validated provider-native official California fiscal/public-finance files, or the run explicitly blocks without profile promotion.
- Required artifacts are present and non-placeholder.
- `dataset_briefing.md` accurately states the coverage and limitations without dropping existing econ inventory entries.
- `improvement_result.json` identifies `datasetId: econ`, `source: raw/calcfi`, landed files, validation evidence, and whether profile/docs were updated.
