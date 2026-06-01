Canonical dataset maintenance request for dataset `econ`.

Goal: add the official BLS Consumer Expenditure Survey Public Use Microdata 2024 CSV packages to the canonical econ dataset.

Source authority:
- Official landing page: https://www.bls.gov/cex/pumd_data.htm
- The landing page says Public Use Microdata are available in SAS, STATA, and CSV; each year is split into Interview and Diary ZIP files; 2024 CSV files are listed as Interview (52.4 MB) and Diary (7.8 MB). Last Modified Date on the page is May 15, 2026.
- Candidate 2024 CSV ZIP URLs to verify before using:
  - https://www.bls.gov/cex/pumd/csxintvw24.zip
  - https://www.bls.gov/cex/pumd/csxdiary24.zip

Required behavior:
1. Perform the standard write probe for dataset `econ`.
2. Verify the official landing page and candidate ZIP URLs before adding anything. If the candidate ZIP URLs do not resolve to ZIP files or the landing page points to different exact hrefs, derive the exact official 2024 CSV Interview and Diary ZIP hrefs from the BLS landing page and record the evidence in the maintenance artifacts. Do not use mirrors or unofficial copies.
3. Store provider archives exactly under `raw/bls_ce_pumd_2024/`. Preserve ZIPs; do not persistently explode all members into the canonical dataset unless required for cheap profiling.
4. Produce inventory metadata for each ZIP: source URL, byte size, SHA-256, ZIP member list, compressed/uncompressed size totals, and cheap row/field counts for CSV members where feasible.
5. Document the coverage: CE PUMD contains household-level expenditure, income, demographic, consumer-unit, weight, and related public-use microdata; Interview covers major and recurring expenditures, Diary covers smaller/frequently purchased items; BLS notes Interview packages beginning in 2020 contain quarters 2, 3, and 4 of the listed year plus quarter 1 of the following year.
6. Update the mounted dataset briefing and docs mirrors with the new source family, inventory, and remaining gaps. Keep the language precise: this improves household consumption microdata coverage but still does not make the econ dataset complete for every economist need.
7. Update the dataset profile/quality metadata so `canonical:dataset -- status --dataset-id econ` can show the new execution as the current disk inventory proof.

Success evidence required:
- Admin execution id and status URL.
- Evidence that the BLS landing page and ZIPs were verified.
- Paths written under `raw/bls_ce_pumd_2024/`.
- Updated briefing/profile artifacts.
- Final status must be suitable for local validation with `npm run canonical:dataset -- validate --dataset-id econ --execution-id <execution-id>`.
