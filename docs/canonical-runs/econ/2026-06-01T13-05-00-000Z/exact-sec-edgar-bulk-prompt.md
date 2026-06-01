Canonical dataset maintenance request for dataset `econ`.

Goal: add official SEC EDGAR bulk company fundamentals and filing-history packages to the canonical econ dataset.

Source authority:
- Official SEC API documentation: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- The SEC page states that `data.sec.gov` APIs provide submissions history by filer and extracted XBRL data from financial statements, and that bulk archive ZIP files are recompiled nightly.
- Official bulk ZIP URLs verified from that page:
  - https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip
  - https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip
- Local HEAD checks on 2026-06-01 returned `application/zip`; `companyfacts.zip` was 1,385,082,359 bytes and last modified Sat, 30 May 2026 05:15:44 GMT; `submissions.zip` was 1,542,907,394 bytes and last modified Sat, 30 May 2026 05:22:53 GMT.

Required behavior:
1. Perform the standard write probe for dataset `econ`.
2. Verify the official SEC documentation page and ZIP URLs before adding anything. Use a responsible descriptive SEC User-Agent. Do not use mirrors or unofficial copies.
3. Store provider archives exactly under `raw/sec_edgar_bulk/`. Preserve ZIPs; do not persistently explode the full archive contents into the canonical dataset because the archives contain many JSON members.
4. Produce inventory metadata for each ZIP: source URL, byte size, Last-Modified if available, SHA-256, member count, compressed/uncompressed size totals, and a small sampled member inventory. If cheap, count JSON members and summarize a handful of top-level fields without materializing all files.
5. Document coverage precisely:
   - `companyfacts.zip` contains public XBRL company facts and frame/company-facts API data from financial statements such as 10-K, 10-Q, 8-K, 20-F, 40-F, 6-K and variants.
   - `submissions.zip` contains public EDGAR filing history for all filers from the Submissions API.
   - This materially improves firm, public-company fundamentals, securities filing history, and market-structure research coverage, but it does not cover private firms, licensed CRSP/Compustat/WRDS datasets, full filing document text, or every regulatory dataset an economist might need.
6. Update the mounted dataset briefing and docs mirrors with the new source family, inventory, and remaining gaps. Keep the language precise: this expands public company/filer coverage but still does not make the econ dataset complete for every economist need.
7. Update the dataset profile/quality metadata so `canonical:dataset -- status --dataset-id econ` can show this execution as the current disk inventory proof.

Success evidence required:
- Admin execution id and status URL.
- Evidence that the SEC documentation page and ZIP URLs were verified.
- Paths written under `raw/sec_edgar_bulk/`.
- Updated briefing/profile artifacts.
- Final status must be suitable for local validation with `npm run canonical:dataset -- validate --dataset-id econ --execution-id <execution-id>`.
