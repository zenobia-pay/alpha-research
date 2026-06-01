Improve the canonical `econ` dataset with official USDA National Agricultural Statistics Service QuickStats bulk data.

This is a canonical dataset maintenance job for dataset id `econ`. Do not run a user research analysis. Add provider-native source files, checksums, and concise inventory documentation so the dataset profile can truthfully describe this coverage.

Source page:
- https://www.nass.usda.gov/datasets/

Required files to download and preserve under `raw/usda_nass_quickstats_20260530/`:
- `Readme.txt` from `https://www.nass.usda.gov/datasets/Readme.txt`
- `qs.economics_20260530.txt.gz` from `https://www.nass.usda.gov/datasets/qs.economics_20260530.txt.gz`
- `qs.census2022.txt.gz` from `https://www.nass.usda.gov/datasets/qs.census2022.txt.gz`

Verified HTTP metadata on 2026-06-01:
- `qs.economics_20260530.txt.gz`: HTTP 200, content type `application/x-gzip`, content length `583970587`, last modified `Sat, 30 May 2026 07:09:53 GMT`.
- `qs.census2022.txt.gz`: HTTP 200, content type `application/x-gzip`, content length `309188711`, last modified `Wed, 14 Feb 2024 19:25:51 GMT`.
- `Readme.txt`: HTTP 200, content type `text/plain; charset=UTF-8`, content length `5117`, last modified `Mon, 30 Jan 2023 10:45:57 GMT`.

For each downloaded file:
- Record URL, HTTP status, content type, last-modified header, compressed byte count, and SHA256.
- Verify gzip integrity for the `.gz` files.
- Stream the first header line from each gzipped TSV and record the column names.
- Stream row counts without committing an uncompressed copy of the full TSV.
- Add a small metadata JSON file in the same raw directory with the facts above.

Documentation/profile update requirements:
- Update `docs/public-datasets/briefings/econ.md` and the dataset profile metadata to include USDA NASS QuickStats coverage.
- Describe this as USDA NASS agriculture economics and 2022 Census of Agriculture QuickStats bulk coverage, not as complete USDA/ERS or complete agriculture microdata coverage.
- Retain existing notes about remaining gaps. In particular, mention that the full QuickStats crops, animals/products, demographics, and environmental bulk files were not included in this job, and ERS datasets, API-keyed USDA services, and restricted/confidential agriculture microdata remain separate gaps.
- Preserve the existing disk inventory proof fields and set/update the inventory/provenance fields for this execution.

Return a short maintenance summary including file counts, byte counts, row counts, checksums, and any skipped or inaccessible files.
