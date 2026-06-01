You are running an admin-owned canonical dataset improvement for `econ`.

Goal: add official U.S. Census Bureau state and local government finance public-use data to the canonical econ dataset.

Why this matters:
- The current econ coverage roadmap explicitly lists Census government finance as incomplete.
- Public finance economists need state/local revenue, expenditure, debt, and cash/security holdings data by government unit and item code.
- The official 2023 Census state/local public-use ZIP is compact enough for a controlled provider-native ingestion.

Official sources verified by the operator on 2026-06-01:
- Landing page: `https://www.census.gov/data/datasets/2023/econ/local/public-use-datasets.html`
- Public-use ZIP: `https://www2.census.gov/programs-surveys/gov-finances/tables/2023/2023_Individual_Unit_Files.zip`
  - HTTP 200
  - content-type: `application/zip`
  - content-length: `3807665`
  - last-modified: `Thu, 31 Jul 2025 13:00:27 GMT`
- Methodology PDF: `https://www2.census.gov/programs-surveys/gov-finances/technical-documentation/methodology/2023/2023_methodology.pdf`
  - HTTP 200
  - content-type: `application/pdf`
  - content-length: `251718`
  - last-modified: `Mon, 18 Aug 2025 20:30:25 GMT`

Required behavior:
1. Perform the standard real create/delete write probe inside the `econ` dataset root before any dataset mutation.
2. Verify the official Census landing page and exact ZIP/PDF URLs above from Census-hosted domains. Do not use mirrors.
3. Download and preserve the provider-native files under `raw/census_gov_finances_2023/`:
   - `2023_Individual_Unit_Files.zip`
   - `2023_methodology.pdf`
   - a metadata JSON file recording source URLs, retrieval time, HTTP headers where available, byte sizes, SHA-256 hashes, ZIP member inventory, row counts if practical, and coverage notes.
4. Inspect the ZIP central directory and, where practical without exploding the mounted volume into many small files, inspect member headers/row counts. Prefer streaming inspection or temporary workspace extraction outside the dataset raw directory.
5. Record inventory metadata for each stored file: path, source URL, byte size, SHA-256, last-modified if available, member count, and concise content summary.
6. Document coverage precisely:
   - 2023 Annual Survey of State and Local Government Finances / state-local public-use individual unit records.
   - Records cover government unit code, item code, amount, and related fields for annual sample respondents, with statistics on revenue, expenditure, debt, and assets/cash/security holdings for U.S. governments.
   - Coverage includes 50 state areas, the District of Columbia, and national summary context per the landing page.
   - This materially fills the `Census government finance` public-finance gap, but it does not cover every state/local fiscal archive, all historical vintages, detailed CAFR/ACFR statement line items, or proprietary fiscal datasets.
7. Update the mounted dataset briefing, docs mirrors, manifest/profile/quality metadata, and produced artifacts so this execution becomes the current disk inventory proof.
8. Keep the language honest: this improves public finance coverage; the econ dataset is still not complete for every economist need.

Success evidence required:
- Admin execution id and status URL.
- Evidence that the Census landing page, public-use ZIP, and methodology PDF were verified.
- Paths written under `raw/census_gov_finances_2023/`.
- ZIP member inventory and row-count/field-count evidence where practical.
- Updated briefing/profile artifacts.
- Final status must be suitable for local validation with `npm run canonical:dataset -- validate --dataset-id econ --execution-id <execution-id>`.
