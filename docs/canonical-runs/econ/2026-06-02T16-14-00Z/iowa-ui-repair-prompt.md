# Econ Iowa UI Repair

Objective: repair the empty `raw/iowa_ui` directory by landing a compact, valid public Iowa unemployment-insurance, unemployment claims, labor-force, or Iowa Workforce Development public data package, then produce canonical inventory artifacts for docs/profile synchronization.

Context:
- This is an admin-owned canonical dataset maintenance job for dataset `econ`.
- Prior read-only inspection found `/data/datasets/econ/raw/iowa_ui` exists but is empty; local prompt record is `docs/canonical-runs/econ/2026-06-02T02-45-09Z/iowa-ui-readonly-inspection-prompt.md`.
- Do not use user-facing research run paths. Work only on the mounted canonical dataset volume.

Constraints:
- Use the mounted dataset path from `DATASET_MOUNT_PATH` if set, otherwise `/data/datasets/econ`.
- Before writing under the dataset directory, perform an actual create/write/delete probe in the dataset root or `raw/iowa_ui`; if it fails, stop with blocker `dataset_dir_not_writable` and the non-secret filesystem error.
- Land only raw/provider-native public source files and small local metadata/inventory helpers. Do not create merged panels, derived columns, joined analytics, or analysis-ready transformations.
- Prefer official Iowa Workforce Development, Iowa open-data portal, Iowa LMI, U.S. DOL ETA state claims, or other official public endpoints. If Iowa-specific unemployment-insurance public bulk cannot be located or downloaded reliably, a closely related official Iowa labor-market/claims source may be landed only if clearly labeled conservatively and useful for economist coverage.
- Keep the repair compact and bounded. Avoid broad recursive crawls, browser-only scraping, or pages that require session/captcha/terms acceptance beyond ordinary public access.
- Preserve provider terms/attribution caveats. Do not include secrets or credentials in artifacts.
- Do not leave HTML error pages, redirects, AccessDenied XML, or startup placeholders as promoted data.

Required work:
1. Create or reuse `raw/iowa_ui`.
2. Locate an official public Iowa UI/claims/labor-market data source.
3. Download the provider-native file(s) into `raw/iowa_ui`.
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
6. If valid files are landed, update the dataset briefing/docs mirror with a conservative `raw/iowa_ui/` inventory entry including file names, sizes, hashes, row counts, provider, coverage, terms caveat, and limitations.
7. If no valid Iowa UI/labor-market source can be landed, do not promote the empty directory as coverage. Record the exact blocker and keep `raw/iowa_ui` documented as absent/empty.
8. Update the canonical econ profile only after the real disk inventory is proven. Profile readback must remain `disk_proven`, `diskInventoryProven: true`, and must not contain startup placeholder text.

Success criteria:
- `raw/iowa_ui` contains one or more real validated provider-native official Iowa UI/claims/labor-market files, or the run explicitly blocks without profile promotion.
- Required artifacts are present and non-placeholder.
- `dataset_briefing.md` accurately states the coverage and limitations without dropping existing econ inventory entries.
- `improvement_result.json` identifies `datasetId: econ`, `source: raw/iowa_ui`, landed files, validation evidence, and whether profile/docs were updated.
