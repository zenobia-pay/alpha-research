Improve the canonical `econ` dataset with official World Bank World Development Indicators (WDI) bulk CSV data.

This is a canonical dataset maintenance job for dataset id `econ`. Do not run a user research analysis. Add provider-native source files, checksums, row/member inventory, and concise documentation so the dataset profile can truthfully describe this coverage.

Official source pages:
- https://datatopics.worldbank.org/world-development-indicators/
- https://datacatalog.worldbank.org/search/dataset/0037712/world-development-indicators

Source-page facts verified on 2026-06-01:
- The WDI page describes World Development Indicators as the World Bank's premier compilation of relevant, high-quality, internationally comparable statistics about global development and the fight against poverty.
- The WDI page says bulk Excel and CSV files are available and are revised whenever WDI is updated.
- The WDI page links the CSV bulk download as `https://databank.worldbank.org/data/download/WDI_CSV.zip`.
- The current CSV bulk download redirects to `https://databankfiles.worldbank.org/public/ddpext_download/WDI_CSV.zip`.

Required file to download and preserve under `raw/world_bank_wdi_20260409/`:
- `WDI_CSV.zip` from `https://databank.worldbank.org/data/download/WDI_CSV.zip`

Verified HTTP metadata locally on 2026-06-01:
- Redirect target: `https://databankfiles.worldbank.org/public/ddpext_download/WDI_CSV.zip`
- Final HTTP status: 200
- Content type: `application/octet-stream`
- Content length: `280478558`
- Last-Modified: `Thu, 09 Apr 2026 10:25:13 GMT`
- Cache-Control: `public, max-age=3600`

For the downloaded ZIP:
- Record original URL, redirect target, final HTTP status, content type, last-modified header, byte count, ETag if present, and SHA256.
- Verify ZIP integrity.
- Inventory ZIP members with compressed/uncompressed sizes.
- Stream row and column counts for CSV members without extracting full CSVs into the canonical raw directory.
- Capture the country, series, and time coverage from metadata files when available.
- Add a metadata JSON file in the same raw directory with the facts above.

Documentation/profile update requirements:
- Update `docs/public-datasets/briefings/econ.md`, `docs/public-datasets/econ.mdx`, and the dataset profile metadata to include World Bank WDI coverage.
- Describe this as broad cross-country development and macroeconomic indicators, including national accounts, prices, poverty, demographics, education, health, environment, infrastructure, trade, debt, finance, governance-adjacent, and country/series metadata where present in the WDI package.
- Retain existing notes about remaining gaps. In particular, mention that WDI does not replace World Bank microdata, full DataBank database families beyond WDI, IMF/OECD/Eurostat/UN sources, restricted microdata, or licensed/proprietary data.
- Update the Coverage Roadmap line for international trade, agriculture, and development so it says WDI is now present while still listing UN Comtrade, WTO, ILOSTAT, additional IMF datasets, Eurostat/ECB breadth, restricted/confidential agriculture microdata, and other World Bank databases beyond WDI as incomplete.
- Preserve the existing disk inventory proof fields and set/update the inventory/provenance fields for this execution.

Operational constraints:
- Preserve the provider ZIP compressed; do not extract all CSVs into the canonical raw directory.
- Use streaming readers for member inventories and row/header counts.
- Keep the addition provider-native: no merged panels, derived fields, cross-source joins, or analysis-ready artifacts.
- Before downloads or profile work, require an actual create/delete probe in the dataset root. A failed write probe must block the run as `dataset_dir_not_writable` or the exact non-secret filesystem error.

Return a short maintenance summary including file counts, byte counts, row counts, checksums, and any skipped or inaccessible files.
