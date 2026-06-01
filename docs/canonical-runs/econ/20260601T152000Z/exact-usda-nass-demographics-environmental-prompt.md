Improve the canonical `econ` dataset with additional official USDA National Agricultural Statistics Service QuickStats bulk data for demographics and environmental measures.

This is a canonical dataset maintenance job for dataset id `econ`. Do not run a user research analysis. Add provider-native source files, checksums, and concise inventory documentation so the dataset profile can truthfully describe this coverage.

Important cleanup requirement:
- A prior College Scorecard attempt (`118674b1-e180-4953-83df-9e9ad084fbc9`) reached `ready` but did not retrieve data because the remote worker received persistent CloudFront 403 responses. Do not describe College Scorecard as landed data in `dataset_briefing.md`, `docs/public-datasets/briefings/econ.md`, `docs/public-datasets/econ.mdx`, or profile `briefingMarkdown`. If a `raw/college_scorecard_20260323/` failure-metadata directory exists, it may remain as operational evidence, but it must not be counted as data coverage or included in the public data inventory. Keep College Scorecard listed only as a remaining gap/follow-up if mentioned.

Source page:
- https://www.nass.usda.gov/datasets/

Required files to download and preserve under `raw/usda_nass_quickstats_20260530_more/`:
- `qs.environmental_20260530.txt.gz` from `https://www.nass.usda.gov/datasets/qs.environmental_20260530.txt.gz`
- `qs.demographics_20260530.txt.gz` from `https://www.nass.usda.gov/datasets/qs.demographics_20260530.txt.gz`

Verified HTTP metadata on 2026-06-01:
- `qs.environmental_20260530.txt.gz`: HTTP 200, content type `application/x-gzip`, content length `73827857`, last modified `Sat, 30 May 2026 07:02:21 GMT`.
- `qs.demographics_20260530.txt.gz`: HTTP 200, content type `application/x-gzip`, content length `466552433`, last modified `Sat, 30 May 2026 07:08:42 GMT`.

For each downloaded file:
- Record URL, HTTP status, content type, last-modified header, compressed byte count, and SHA256.
- Verify gzip integrity.
- Stream the first header line from each gzipped TSV and record column names.
- Stream row counts without committing an uncompressed copy of the full TSV.
- Add a small metadata JSON file in the same raw directory with the facts above.

Documentation/profile update requirements:
- Update `docs/public-datasets/briefings/econ.md`, `docs/public-datasets/econ.mdx`, and the dataset profile metadata to include USDA NASS QuickStats demographics and environmental coverage.
- Describe this as additional USDA NASS QuickStats public bulk coverage for agriculture demographics and environmental measures, complementing the existing NASS economics and 2022 Census of Agriculture QuickStats files.
- Retain existing notes about remaining gaps. In particular, mention that the full QuickStats crops and animals/products bulk files, USDA ERS datasets, API-keyed USDA services, and restricted/confidential agriculture microdata remain separate gaps.
- Preserve the existing disk inventory proof fields and set/update the inventory/provenance fields for this execution.

Return a short maintenance summary including file counts, byte counts, row counts, checksums, and any skipped or inaccessible files.
