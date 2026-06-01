Improve the canonical `econ` dataset with the remaining large official USDA National Agricultural Statistics Service QuickStats bulk categories for crops and animals/products.

This is a canonical dataset maintenance job for dataset id `econ`. Do not run a user research analysis. Add provider-native source files, checksums, and concise inventory documentation so the dataset profile can truthfully describe this coverage.

Source page:
- https://www.nass.usda.gov/datasets/

Required files to download and preserve under `raw/usda_nass_quickstats_20260530_crops_animals/`:
- `qs.crops_20260530.txt.gz` from `https://www.nass.usda.gov/datasets/qs.crops_20260530.txt.gz`
- `qs.animals_products_20260530.txt.gz` from `https://www.nass.usda.gov/datasets/qs.animals_products_20260530.txt.gz`

Verified HTTP metadata on 2026-06-01:
- `qs.crops_20260530.txt.gz`: HTTP 200, content type `application/x-gzip`, content length `1124255738`, last modified `Sat, 30 May 2026 07:13:38 GMT`.
- `qs.animals_products_20260530.txt.gz`: HTTP 200, content type `application/x-gzip`, content length `463124366`, last modified `Sat, 30 May 2026 07:08:24 GMT`.

For each downloaded file:
- Record URL, HTTP status, content type, last-modified header, compressed byte count, and SHA256.
- Verify gzip integrity.
- Stream the first header line from each gzipped TSV and record column names.
- Stream row counts without committing an uncompressed copy of the full TSV.
- Add a metadata JSON file in the same raw directory with the facts above.

Documentation/profile update requirements:
- Update `docs/public-datasets/briefings/econ.md`, `docs/public-datasets/econ.mdx`, and the dataset profile metadata to include USDA NASS QuickStats crops and animals/products coverage.
- Describe this as completing the major public USDA NASS QuickStats bulk category set already represented by economics, 2022 Census of Agriculture, demographics, and environmental files.
- Retain existing notes about remaining gaps. In particular, mention that USDA ERS datasets, API-keyed USDA services, restricted/confidential agriculture microdata, and non-US agriculture/trade sources remain separate gaps.
- Preserve the existing disk inventory proof fields and set/update the inventory/provenance fields for this execution.

Operational constraints:
- Preserve provider `.txt.gz` files compressed; do not extract full TSVs into the canonical raw directory.
- Use streaming readers for row/header counts.
- Monitor disk space/inodes before and after the run if practical.

Return a short maintenance summary including file counts, byte counts, row counts, checksums, and any skipped or inaccessible files.
