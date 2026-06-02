# Econ BLS PPI Repair

You are running an admin-owned canonical improvement job for `econ`.

Objective: repair the known-bad `raw/bls_ppi` source by replacing the captured Access Denied HTML payload with valid Bureau of Labor Statistics Producer Price Index public flat-file data, then produce the canonical inventory artifacts needed for profile/docs synchronization.

Context:

- Prior read-only inspection `c7af9138-51d2-4fb2-9d4e-8fd7e43acca3` found `/data/datasets/econ/raw/bls_ppi/ppi.data.0.Current` was only a 1,325-byte Access Denied HTML response.
- Do not claim PPI coverage unless the resulting files are real BLS tabular flat files with headers and data rows.

Hard rules:

- This is an admin-owned canonical dataset repair job for `econ`, not a user-facing research run.
- Use the mounted dataset directory from `$DATASET_DIR`, `$DATASET_MOUNT_PATH`, or `/data/datasets/econ`.
- Before writing under the dataset directory, perform an actual create/write/delete probe in the dataset root or `raw/bls_ppi`; if it fails, stop with blocker `dataset_dir_not_writable` and the non-secret filesystem error.
- Preserve provider-native public source files only. Do not create merged panels, derived fields, cross-source joins, or analysis artifacts.
- Reject and do not promote HTML error pages, XML AccessDenied pages, empty files, or non-BLS payloads.
- Keep downloads bounded to BLS PPI public data files needed to establish a real PPI seed package.
- Do not print secrets, tokens, webhook URLs, or auth headers.

Required acquisition:

1. Create or reuse `raw/bls_ppi`.
2. Attempt to download official BLS public PPI flat files from stable BLS public data endpoints, preferring `https://download.bls.gov/pub/time.series/pc/`.
3. At minimum, land a valid current data file such as `pc.data.0.Current` or equivalent current PPI data file plus relevant lookup/metadata files when available, such as `pc.series`, `pc.item`, `pc.industry`, `pc.product`, `pc.period`, `pc.seasonal`, and footnote/base files.
4. For every downloaded candidate, validate:
   - HTTP status/final URL;
   - byte size;
   - file is not HTML/XML error content;
   - first line/header;
   - row count;
   - SHA-256.
5. If BLS blocks access or the endpoint shape has changed, write a blocked result and explain the exact non-secret failure; do not update profile/docs as successful.

Required artifacts:

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
- docs mirrors when possible:
  - `docs/public-datasets/briefings/econ.md`
  - `docs/public-datasets/econ.mdx`

Briefing/profile requirements:

- If valid BLS PPI files are landed, update the dataset briefing/docs mirror with a conservative `raw/bls_ppi/` inventory entry including file names, sizes, hashes, row counts, headers, provider, and limitations.
- Keep the existing inventory entries intact.
- Remove or supersede the prior gap-audit statement that PPI is absent only if the new landed files prove real coverage.
- Update backend profile/readback only after successful validation.

Final response must be exactly:

```md
status: completed|blocked
dataset_id: econ
source: raw/bls_ppi
run_id: <run id>
summary: <one line>
```
