Improve the canonical `econ` dataset with official USDA Economic Research Service Farm Income and Wealth Statistics data.

This is a canonical dataset maintenance job for dataset id `econ`. Do not run a user research analysis. Add provider-native source files, checksums, row/member inventory, and concise documentation so the dataset profile can truthfully describe this coverage.

Official source page:
- https://www.ers.usda.gov/data-products/farm-income-and-wealth-statistics/data-files-us-and-state-level-farm-income-and-wealth-statistics

Source-page facts verified on 2026-06-01:
- Page title: "Farm Income and Wealth Statistics - Data Files: U.S. and State-Level Farm Income and Wealth Statistics".
- Page updated: `5/19/2026`.
- Page states these are the latest U.S. farm sector income and wealth statistics, including historical U.S. and State-level farm income and wealth estimates and U.S.-level forecasts for the current calendar year.
- Page states that, unless otherwise noted, data are as of February 5, 2026.

Required files to download and preserve under `raw/usda_ers_farm_income_wealth_20260205/`:
- `february-5-2026-release.zip` from `https://www.ers.usda.gov/media/20808/february-5-2026-release.zip`
- `farm-income-data-archive.zip` from `https://www.ers.usda.gov/media/20807/farm-income-data-archive.zip`

Verified HTTP metadata locally on 2026-06-01:
- `february-5-2026-release.zip`: HTTP 200, content type `application/zip`, content length `5799772`.
- `farm-income-data-archive.zip`: HTTP 200, content type `application/zip`, content length `108768`.

For each downloaded file:
- Record URL, HTTP status, content type, last-modified header when present, byte count, and SHA256.
- Verify ZIP integrity.
- Inventory ZIP members with compressed/uncompressed sizes.
- For CSV members, count rows and columns by streaming from the ZIP without extracting full files into many small files on the dataset volume.
- Add a metadata JSON file in the same raw directory with the facts above.

Documentation/profile update requirements:
- Update `docs/public-datasets/briefings/econ.md`, `docs/public-datasets/econ.mdx`, and the dataset profile metadata to include USDA ERS Farm Income and Wealth Statistics coverage.
- Describe this as USDA ERS farm sector income, wealth, cash receipts, government payments, expenses, balance sheet, financial ratios, and related U.S./State estimate/forecast coverage.
- Retain existing notes about remaining gaps. In particular, mention that this does not replace restricted ARMS microdata, all USDA ERS data products, API-keyed USDA services, AMS/FAS datasets, or non-U.S. agriculture/trade datasets.
- Preserve the existing disk inventory proof fields and set/update the inventory/provenance fields for this execution.

Operational constraints:
- Preserve provider ZIP files compressed; do not extract all CSVs into the canonical raw directory.
- Use streaming readers for member inventories and row/header counts.

Return a short maintenance summary including file counts, byte counts, row counts, checksums, and any skipped or inaccessible files.
