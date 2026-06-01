# Econ Census BPS master attempted run

- Execution id: `b1d5b358-0368-4edc-9d66-5c7269cac6b7`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/b1d5b358-0368-4edc-9d66-5c7269cac6b7`
- Field target: official U.S. Census Building Permits Survey Master Data Set compiled file, documentation, and sample CSV under `raw/census_bps_master_202604/`.

## Outcome

The admin execution started and proved the mounted econ dataset path was writable after several quoting failures:

- `/data/datasets/econ/.canonical_probe` was created and removed successfully at `2026-06-01T19:09:27Z` to `2026-06-01T19:09:28Z`.

The execution then attempted to move into the Census BPS phase, but it did not produce verifiable mounted-volume dataset evidence before stalling:

- It failed an initial `dataset/scripts/log_download.py` invocation for `source_id` `census_bps_master_202604`.
- It created a scratch-directory path `raw/census_bps_master_202604` in the remote worker context rather than proving writes under `/data/datasets/econ/raw/census_bps_master_202604/`.
- It checked `dataset/raw/census_bps`, which does not match the requested canonical target directory.
- It failed a malformed Python/path command beginning with `python - "$DATASET_MOUNT_PATH"` at `2026-06-01T19:18:59Z`.
- The latest observed heartbeat at `2026-06-01T19:25:16Z` still reported the same failed command as last activity, with artifact count unchanged at 88.

Because the provider-native Census BPS archive, documentation, and sample CSV were not proven on the mounted canonical dataset volume, this attempt did not update:

- `docs/public-datasets/briefings/econ.md`
- `docs/public-datasets/econ.mdx`
- the backend econ dataset profile

The prior proven profile remains the FHFA HPI master update from execution `91a949cc-5830-4e9e-a93e-f3c1845e7ef6`.

## Verified source candidate

Before launching the run, the following official Census URLs were verified by HTTP HEAD requests:

- `https://www2.census.gov/econ/bps/Master%20Data%20Set/BPS_Compiled_File_202604.zip` returned HTTP 200, `content-type: application/zip`, `content-length: 458582881`, and `last-modified: Thu, 28 May 2026 14:15:43 GMT`.
- `https://www2.census.gov/econ/bps/Master%20Data%20Set/Compiled%20Data%20Documentation.docx` returned HTTP 200 and `content-type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- `https://www2.census.gov/econ/bps/Master%20Data%20Set/Compiled%20File%20Sample.csv` returned HTTP 200, `content-type: text/csv`, `content-length: 6617`, and `last-modified: Tue, 26 Jul 2022 14:56:48 GMT`.

## Next step

Relaunch a narrower canonical admin run that writes directly to `/data/datasets/econ/raw/census_bps_master_202604/`, avoids scratch `raw/` paths, and performs a minimal `curl -L --fail` download plus `sha256sum`, `unzip -t`, `zipinfo`, and streamed row/header checks before any profile update.
