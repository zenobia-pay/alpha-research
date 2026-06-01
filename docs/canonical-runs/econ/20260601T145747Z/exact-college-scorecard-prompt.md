Improve the canonical `econ` dataset with official U.S. Department of Education College Scorecard downloadable data.

This is a canonical dataset maintenance job for dataset id `econ`. Do not run a user research analysis. Add provider-native source files, checksums, row/member inventory, and concise documentation so the dataset profile can truthfully describe this coverage.

Official source page:
- https://collegescorecard.ed.gov/data/

Official documentation pages:
- https://collegescorecard.ed.gov/data/api/
- https://collegescorecard.ed.gov/assets/InstitutionDataDocumentation.pdf
- https://collegescorecard.ed.gov/assets/FieldOfStudyDataDocumentation.pdf

The official download page states the data was last updated March 23, 2026.

Required files to download and preserve under `raw/college_scorecard_20260323/`:
- `College_Scorecard_Raw_Data_03232026.zip` from `https://ed-public-download.scorecard.network/downloads/College_Scorecard_Raw_Data_03232026.zip`
- `Most-Recent-Cohorts-Institution_03232026.zip` from `https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution_03232026.zip`
- `Most-Recent-Cohorts-Field-of-Study_03232026.zip` from `https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Field-of-Study_03232026.zip`
- `CollegeScorecardDataDictionary.xlsx` from `https://collegescorecard.ed.gov/assets/CollegeScorecardDataDictionary.xlsx`
- `InstitutionDataDocumentation.pdf` from `https://collegescorecard.ed.gov/assets/InstitutionDataDocumentation.pdf`
- `FieldOfStudyDataDocumentation.pdf` from `https://collegescorecard.ed.gov/assets/FieldOfStudyDataDocumentation.pdf`

Verified HTTP metadata locally on 2026-06-01:
- `College_Scorecard_Raw_Data_03232026.zip`: HTTP 200, content type `application/zip`, content length `466747163`, last modified `Mon, 16 Mar 2026 01:17:33 GMT`.
- `Most-Recent-Cohorts-Institution_03232026.zip`: HTTP 200, content type `application/zip`, content length `23774247`, last modified `Mon, 16 Mar 2026 01:17:08 GMT`.
- `Most-Recent-Cohorts-Field-of-Study_03232026.zip`: HTTP 200, content type `application/zip`, content length `17187669`, last modified `Mon, 09 Mar 2026 23:38:40 GMT`.
- `CollegeScorecardDataDictionary.xlsx`: HTTP 200, content type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, content length `681418`, last modified `Mon, 14 Oct 2024 20:28:05 GMT`.
- `InstitutionDataDocumentation.pdf`: HTTP 200, content type `application/pdf`, content length `597772`, last modified `Mon, 14 Oct 2024 20:28:05 GMT`.
- `FieldOfStudyDataDocumentation.pdf`: HTTP 200, content type `application/pdf`, content length `891554`, last modified `Mon, 14 Oct 2024 20:28:05 GMT`.

For each downloaded file:
- Record URL, HTTP status, content type, last-modified header, byte count, and SHA256.
- Verify ZIP integrity for ZIP files.
- Inventory ZIP members with compressed/uncompressed sizes.
- For CSV data members, stream row counts and column counts without extracting full CSVs into many small files on the dataset volume.
- For XLSX/PDF documentation files, record byte count, SHA256, and enough metadata to prove the files are present.
- Add a small metadata JSON file in the same raw directory with the facts above.

Documentation/profile update requirements:
- Update `docs/public-datasets/briefings/econ.md`, `docs/public-datasets/econ.mdx`, and the dataset profile metadata to include College Scorecard coverage.
- Describe this as institution-level historical raw Scorecard files, most-recent institution-level data, most-recent field-of-study data, and documentation/data dictionary coverage for costs, aid, debt, repayment, completion, earnings, institutional characteristics, and field-of-study outcomes.
- Retain existing notes about remaining gaps. In particular, mention that this complements but does not replace IPEDS, restricted student-level NSLDS/IRS records, non-Title-IV institutions where not present, historical common data sets, school-level K-12 data, or licensed/private education datasets.
- Preserve the existing disk inventory proof fields and set/update the inventory/provenance fields for this execution.

Return a short maintenance summary including file counts, byte counts, row counts, checksums, and any skipped or inaccessible files.
