You are running an admin-owned canonical dataset improvement for `econ`.

Goal: add official Centers for Medicare & Medicaid Services National Health Expenditure Accounts historical data to the canonical econ dataset.

Why this matters:
- The current econ coverage roadmap explicitly lists CMS/health spending as incomplete.
- Health economists, public finance researchers, macroeconomists, and policy analysts need official U.S. health spending series by service, funding source, sponsor, GDP share, payer/program, and investment category.
- CMS National Health Expenditure Accounts are the official estimates of total U.S. health care spending.

Official sources verified by the operator on 2026-06-01:
- Landing page: `https://www.cms.gov/data-research/statistics-trends-and-reports/national-health-expenditure-data/historical`
  - Page says the NHEA are official estimates of total health care spending in the United States.
  - Page says the series date back to 1960 and measure annual U.S. expenditures for health care goods and services, public health activities, government administration, non-medical insurance expenditures, and investment.
  - Page says the data are presented by type of service, source of funding, and type of sponsor.
  - Page says 2024 U.S. health care spending grew 7.2 percent, reached $5.3 trillion or $15,474 per person, and was 18.0 percent of GDP.
  - Page Last Modified: `01/14/2026 04:59 PM`.
- NHE Tables ZIP: `https://www.cms.gov/files/zip/nhe-tables.zip`
  - HTTP 200
  - content-type: `application/zip`
  - content-length: `520391`
  - content-disposition filename: `nhe24-tables.zip`
  - last-modified: `Tue, 13 Jan 2026 13:55:49 GMT`
- National Health Expenditures by type of service and source of funds, CY 1960-2024 ZIP: `https://www.cms.gov/files/zip/national-health-expenditures-type-service-source-funds-cy-1960-2024.zip`
  - HTTP 200
  - content-type: `application/zip`
  - content-length: `123721`
  - content-disposition filename: `nhe2024.zip`
  - last-modified: `Tue, 13 Jan 2026 13:58:16 GMT`
- NHE Summary, including share of GDP, CY 1960-2024 ZIP: `https://www.cms.gov/files/zip/nhe-summary-including-share-gdp-cy-1960-2024.zip`
  - HTTP 200
  - content-type: `application/zip`
  - content-length: `19575`
  - content-disposition filename: `nhe24_summary.zip`
  - last-modified: `Tue, 13 Jan 2026 14:01:26 GMT`
- Definitions, Sources, and Methods PDF: `https://www.cms.gov/files/document/definitions-sources-methods.pdf`
  - HTTP 200
  - content-type: `application/pdf`
  - content-length: `658261`
  - content-disposition filename: `dsm-nhe24_v10_final_v1.pdf`
  - last-modified: `Tue, 13 Jan 2026 21:41:06 GMT`

Required behavior:
1. Perform the standard real create/delete write probe inside the `econ` dataset root before any dataset mutation.
2. Verify the official CMS landing page and exact ZIP/PDF URLs above from `cms.gov`. Do not use mirrors.
3. Download and preserve provider-native files under `raw/cms_nhe_2024/`:
   - `nhe24-tables.zip`
   - `nhe2024.zip`
   - `nhe24_summary.zip`
   - `definitions-sources-methods.pdf`
   - a metadata JSON file recording source URLs, retrieval time, HTTP headers where available, byte sizes, SHA-256 hashes, ZIP member inventories, workbook sheet inventories if applicable, row/column counts where practical, and coverage notes.
4. Inspect ZIP central directories and workbook/table files without exploding the mounted volume into many small files. Use temporary workspace extraction if needed.
5. Record inventory metadata for each stored file: path, source URL, byte size, SHA-256, last-modified if available, member count, worksheet/table counts, and concise content summary.
6. Document coverage precisely:
   - Historical National Health Expenditure Accounts through calendar year 2024, with annual U.S. health spending dating back to 1960.
   - Covers national health expenditures, personal health care, hospital care, physician and clinical services, dental, prescription drugs, nursing care, home health, durable and non-durable medical products, public health activities, administration, non-medical insurance, investment, payer/program/source-of-funds measures, sponsor measures, GDP share, aggregate and per-capita amounts where present.
   - This materially fills the CMS/health-spending gap, but it does not replace restricted claims microdata, all Medicare/Medicaid administrative datasets, provider-level cost reports, private claims, or every state/age/sex NHE product.
7. Update the mounted dataset briefing, docs mirrors, manifest/profile/quality metadata, and produced artifacts so this execution becomes the current disk inventory proof.
8. Keep the language honest: this improves U.S. health-spending coverage; the econ dataset is still not complete for every economist need.

Success evidence required:
- Admin execution id and status URL.
- Evidence that the CMS landing page, ZIPs, and methodology PDF were verified.
- Paths written under `raw/cms_nhe_2024/`.
- ZIP/member and workbook/table inventory evidence where practical.
- Updated briefing/profile artifacts.
- Final status must be suitable for local validation with `npm run canonical:dataset -- validate --dataset-id econ --execution-id <execution-id>`.
