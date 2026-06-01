You are running an admin-owned canonical dataset improvement for `econ`.

Goal: add official FDIC BankFind Suite public bank financial and institution data to the canonical econ dataset.

Why this matters:
- The current econ coverage roadmap explicitly lists FR Y-9C/Call Reports and broader banking/credit datasets as incomplete.
- Bank economists, financial-stability researchers, credit researchers, and public finance analysts need bank-level balance-sheet, income, capital, deposit, loan, asset-quality, geography, and institution metadata.
- FDIC BankFind Suite provides official public data and an API for FDIC-insured financial institutions, including financial reports and institution records.

Official sources verified by the operator on 2026-06-01:
- API documentation: `https://api.fdic.gov/banks/docs/`
  - HTTP 200
  - content-type: `text/html; charset=UTF-8`
  - content-length: `30985`
  - last-modified: `Fri, 24 Apr 2026 15:53:38 GMT`
  - Documentation says FDIC's API lets developers access publicly available bank data.
- BankFind Suite landing page: `https://banks.data.fdic.gov/bankfind-suite`
  - Search result describes public search of FDIC extensive data records and financial trends for institutions, groups, and the industry.
- Financials endpoint sample:
  - `https://api.fdic.gov/banks/financials?limit=2&format=json`
  - HTTP 200; returned `meta.total=1678302`, index `risview_20260526141420`, create timestamp `2026-05-26T14:14:22Z`.
- Institutions endpoint sample:
  - `https://api.fdic.gov/banks/institutions?limit=2&format=json`
  - HTTP 200; returned `meta.total=27835`, index `institutions_20260529090006`, create timestamp `2026-05-29T11:53:34Z`.
- Latest financial reporting date sample:
  - `https://api.fdic.gov/banks/financials?fields=CERT,NAME,REPDTE,ASSET,DEP,NETINC&sort_by=REPDTE&sort_order=DESC&limit=5&format=json`
  - Returned latest `REPDTE=20260331`.
- Latest-quarter financials CSV sample:
  - `https://api.fdic.gov/banks/financials?filters=REPDTE:20260331&limit=10000&format=csv`
  - HTTP 200
  - content-type: `text/csv; charset=utf-8`
  - content-length: `5362387`
  - total rows from JSON metadata for the same filter: `4352`

Required behavior:
1. Perform the standard real create/delete write probe inside the `econ` dataset root before any dataset mutation.
2. Verify official FDIC API documentation and endpoints from `api.fdic.gov` / `banks.data.fdic.gov`. Do not use mirrors or third-party wrappers.
3. Download and preserve provider-native API outputs under `raw/fdic_bankfind_20260331/`:
   - `financials_20260331.csv`: full latest-quarter FDIC BankFind financials for `REPDTE:20260331`, preserving provider field names.
   - `financials_20260331_metadata.json`: endpoint URL, retrieval timestamp, API metadata, HTTP headers where available, row count, field count, byte size, SHA-256, and coverage notes.
   - `institutions_current.csv`: full FDIC BankFind institutions endpoint export if practical in one paginated pass; otherwise a complete current-snapshot JSONL/CSV export preserving provider field names.
   - `institutions_current_metadata.json`: endpoint URL, retrieval timestamp, API metadata, HTTP headers where available, row count, field count, byte size, SHA-256, and coverage notes.
   - `api_docs_snapshot.html` or a compact metadata file proving the docs page was checked.
4. Use API pagination if the API limit requires it. Prefer CSV where available; if CSV pagination is awkward, retrieve JSON page-by-page and write both a provider-shaped JSONL and a CSV projection preserving provider field names.
5. Record inventory metadata for each stored file: path, source URL, byte size, SHA-256, API total, row count, field count, reporting date, and concise field coverage summary.
6. Document coverage precisely:
   - Latest-quarter FDIC-insured institution financials for 2026-03-31, including bank identifiers, call-form metadata, geography, balance-sheet measures, deposits, loans, income, expense, equity/capital, asset-quality, liquidity, securities, and supervisory/geographic fields where present in the FDIC API.
   - Current institution metadata from FDIC BankFind, including certificate/RSSD identifiers, institution names, addresses, status, insurance dates, charter/supervisory fields, bank class, region, MDI/CFPB flags where present, and related descriptive fields.
   - This materially improves banking/credit coverage, but it does not replace complete historical FFIEC Call Report bulk archives, FR Y-9C holding-company reports, restricted supervisory data, full UBPR history, or proprietary bank datasets.
7. Update the mounted dataset briefing, docs mirrors, manifest/profile/quality metadata, and produced artifacts so this execution becomes the current disk inventory proof.
8. Keep the language honest: this improves bank financial and institution coverage; the econ dataset is still not complete for every economist need.

Success evidence required:
- Admin execution id and status URL.
- Evidence that the FDIC docs and endpoints were verified.
- Paths written under `raw/fdic_bankfind_20260331/`.
- Row counts, field counts, hashes, byte sizes, API totals, and reporting date evidence.
- Updated briefing/profile artifacts.
- Final status must be suitable for local validation with `npm run canonical:dataset -- validate --dataset-id econ --execution-id <execution-id>`.
