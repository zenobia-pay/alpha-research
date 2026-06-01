You are running an admin-owned canonical dataset improvement for `econ`.

Goal: add official Social Security Administration Annual Statistical Supplement data to the canonical econ dataset.

Why this matters:
- The current econ coverage roadmap explicitly lists SSA/OASDI tables as incomplete.
- Public finance, labor, retirement, disability, household-income, and demographic economists need Social Security OASDI and SSI statistics on trust funds, covered/insured workers, beneficiaries, payments, awards, terminations, and geographic distributions.
- SSA publishes a compact official Annual Statistical Supplement with PDF and XLSX table files.

Official sources verified by the operator on 2026-06-01:
- Landing page: `https://www.ssa.gov/policy/docs/statcomps/supplement/index.html`
  - Page identifies `Annual Statistical Supplement, 2025`, completed March 2026.
  - Page says the Supplement is a comprehensive resource for statistics on SSA-administered programs, including Old-Age, Survivors, and Disability Insurance and Supplemental Security Income.
  - Page links `Download entire publication` and `Download all tables`.
  - Page notes an errata item posted April 16, 2026 for Table 6.D9, and the corrected value now appears in the report.
  - Page lists Federal Data Catalog Identifier `US-GOV-SSA-3367`.
- Full XLSX tables file: `https://www.ssa.gov/policy/docs/statcomps/supplement/2025/supplement25.xlsx`
  - Verified with browser-style fetch headers.
  - HTTP 200
  - content-type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - last-modified: `Thu, 16 Apr 2026 17:56:03 GMT`
  - downloaded byte count observed by operator: `1837543`
  - file signature begins with ZIP/XLSX bytes `504b0304`
- Full PDF publication: `https://www.ssa.gov/policy/docs/statcomps/supplement/2025/supplement25.pdf`
  - Verified with browser-style fetch headers.
  - HTTP 200
  - content-type: `application/pdf`
  - content-length: `2404980`
  - last-modified: `Thu, 16 Apr 2026 17:56:00 GMT`
  - downloaded byte count observed by operator: `2404980`
  - file signature begins with PDF bytes `%PDF`

Implementation notes:
- Some plain `curl -I` requests may receive 403 from SSA/Akamai even when the files are accessible. Use `fetch`, Python `urllib`/`requests` with a normal browser-style `User-Agent`, or another equivalent official-download method. Do not use mirrors.

Required behavior:
1. Perform the standard real create/delete write probe inside the `econ` dataset root before any dataset mutation.
2. Verify the official SSA landing page and exact XLSX/PDF URLs above from `ssa.gov`. Do not use mirrors, scraped copies, or third-party catalogs as source files.
3. Download and preserve provider-native files under `raw/ssa_annual_statistical_supplement_2025/`:
   - `supplement25.xlsx`
   - `supplement25.pdf`
   - a metadata JSON file recording source URLs, retrieval time, HTTP headers where available, byte sizes, SHA-256 hashes, workbook sheet inventory, row/column counts where practical, and coverage notes.
4. Inspect the XLSX workbook without exploding the mounted volume into many small files. Record sheet names and row/column counts for each worksheet where practical.
5. Record inventory metadata for each stored file: path, source URL, byte size, SHA-256, last-modified if available, workbook sheet count, and concise content summary.
6. Document coverage precisely:
   - 2025 Annual Statistical Supplement tables for SSA-administered programs.
   - Includes OASDI trust funds, covered workers, insured workers, benefits in current-payment status, retired workers, disabled workers, dependents/survivors, geographic OASDI data, direct deposit, representative payees, international agreements, OASDI benefits awarded/withheld/terminated, SSI summaries/state data/payment amount/recipient characteristics, and supporting appendixes where present in the workbook.
   - This materially fills the SSA/OASDI public-finance gap, but it does not replace restricted SSA microdata, longitudinal beneficiary records, individual earnings histories, all historical supplement editions, or every SSA actuarial projection file.
7. Update the mounted dataset briefing, docs mirrors, manifest/profile/quality metadata, and produced artifacts so this execution becomes the current disk inventory proof.
8. Keep the language honest: this improves SSA/OASDI/SSI coverage; the econ dataset is still not complete for every economist need.

Success evidence required:
- Admin execution id and status URL.
- Evidence that the SSA landing page, XLSX, and PDF were verified.
- Paths written under `raw/ssa_annual_statistical_supplement_2025/`.
- XLSX sheet inventory and row/column count evidence where practical.
- Updated briefing/profile artifacts.
- Final status must be suitable for local validation with `npm run canonical:dataset -- validate --dataset-id econ --execution-id <execution-id>`.
