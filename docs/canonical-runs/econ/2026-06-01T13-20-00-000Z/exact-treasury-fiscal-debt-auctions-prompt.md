Canonical dataset maintenance request for dataset `econ`.

Goal: add official U.S. Treasury Fiscal Data public finance/debt/auction datasets to the canonical econ dataset.

Source authority:
- Official Fiscal Data API documentation: https://fiscaldata.treasury.gov/api-documentation/
- The documentation states the Fiscal Data API supports GET requests, JSON/XML/CSV formats, sorting, pagination, and metadata.
- Verified sample CSV endpoints on 2026-06-01:
  - Debt to the Penny:
    `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page%5Bsize%5D=3&format=csv`
  - Average Interest Rates on Treasury Securities:
    `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?sort=-record_date&page%5Bsize%5D=3&format=csv`
  - Treasury Securities Auctions:
    `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query?sort=-auction_date&page%5Bsize%5D=3&format=csv`

Required behavior:
1. Perform the standard write probe for dataset `econ`.
2. Verify the Fiscal Data documentation page and each endpoint before adding anything. Do not use mirrors or unofficial copies.
3. Download complete provider data for the three endpoints, using Fiscal Data pagination if required. Prefer provider CSV output where practical. If CSV pagination is awkward, retrieve JSON page-by-page and write both a provider-shaped JSONL/metadata file and a CSV projection preserving provider field names.
4. Store raw files under `raw/treasury_fiscal_debt_auctions_20260601/`:
   - `debt_to_penny.csv`
   - `avg_interest_rates.csv`
   - `auctions_query.csv`
   - a metadata JSON file recording source URLs, retrieval time, total counts, field names, row counts, byte sizes, hashes, and pagination details.
5. Produce inventory metadata: source URL, byte size, SHA-256, row count, field count, min/max relevant date, and short field coverage notes.
6. Document coverage precisely:
   - Debt to the Penny covers daily public debt outstanding, debt held by the public, and intragovernmental holdings.
   - Average Interest Rates covers average interest rates by Treasury security type/description.
   - Treasury Securities Auctions covers bill/note/bond/TIPS/FRN auction announcements/results including CUSIP, dates, maturity, offering/accepted/tendered amounts, bid-to-cover, high rates/yields/prices where populated, bidder classes, SOMA/FIMA fields, and related auction metadata.
   - This improves public finance, Treasury debt, auction-market, and sovereign-debt research coverage, but it does not replace full TreasuryDirect XML archives, CUSIP master/licensed market data, or every fiscal dataset an economist might need.
7. Update the mounted dataset briefing and docs mirrors with the new source family, inventory, and remaining gaps. Keep the language precise: this expands public finance/debt/auction coverage but still does not make the econ dataset complete for every economist need.
8. Update the dataset profile/quality metadata so `canonical:dataset -- status --dataset-id econ` can show this execution as the current disk inventory proof.

Success evidence required:
- Admin execution id and status URL.
- Evidence that the Fiscal Data documentation page and endpoints were verified.
- Paths written under `raw/treasury_fiscal_debt_auctions_20260601/`.
- Updated briefing/profile artifacts.
- Final status must be suitable for local validation with `npm run canonical:dataset -- validate --dataset-id econ --execution-id <execution-id>`.
