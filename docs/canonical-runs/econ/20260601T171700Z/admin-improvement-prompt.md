You are running an admin-owned canonical improvement job for dataset `econ`.

Goal: add a compact, provider-native ILOSTAT public labor-market slice that directly addresses the current roadmap gap "ILOSTAT" without disturbing the existing economics substrate.

This is canonical dataset improvement work. Do not start `/api/cli/datasets/:datasetId/runs` and do not run `research --prompt`.

## Current source verification

The official ILOSTAT bulk download page is `https://ilostat.ilo.org/data/bulk/`. The page describes the bulk facility as access to individual datasets or all ILOSTAT databases, organized by `indicator`, `ref_area`, and `dic`; data files are offered as compressed/zipped CSV or related bulk files, and the Rilostat package uses this facility.

Live endpoint checks on 2026-06-01 verified current Rilostat bulk RDS endpoints:

- Table of contents: `https://rplumber.ilo.org/files/indicator/table_of_contents_en.rds`
  - Request requires a non-empty User-Agent such as `Rilostat/2.3.4`.
  - HEAD returned HTTP 200 with `content-type: application/octet-stream`; a GET with User-Agent returned a 60 KB gzip-compressed RDS file.
- Annual employment by sex and age, number: `https://rplumber.ilo.org/files/indicator/EMP_2EMP_SEX_AGE_NB_A.rds`
  - HEAD returned HTTP 200, `content-length: 413604`, `last-modified: Sun, 31 May 2026 20:51:34 GMT`, `etag: "6a1c9f56-64fa4"`.
- Annual unemployment rate by sex and age: `https://rplumber.ilo.org/files/indicator/UNE_2EAP_SEX_AGE_RT_A.rds`
  - HEAD returned HTTP 200, `content-length: 281033`, `last-modified: Sun, 31 May 2026 20:51:32 GMT`, `etag: "6a1c9f54-449c9"`.
- Annual labour force participation rate by sex and age: `https://rplumber.ilo.org/files/indicator/EAP_2WAP_SEX_AGE_RT_A.rds`
  - HEAD returned HTTP 200, `content-length: 838930`, `last-modified: Sun, 31 May 2026 20:51:48 GMT`, `etag: "6a1c9f64-ccd12"`.

## Required dataset changes

1. Create `/data/datasets/econ/raw/ilostat_core_labor_20260531/`.
2. Download the four provider files above with a non-empty User-Agent and preserve them verbatim:
   - `table_of_contents_en.rds`
   - `EMP_2EMP_SEX_AGE_NB_A.rds`
   - `UNE_2EAP_SEX_AGE_RT_A.rds`
   - `EAP_2WAP_SEX_AGE_RT_A.rds`
3. Write `metadata.json` in that directory with:
   - source URL for each file
   - HTTP status, response headers available from HEAD/GET, content length or actual byte count
   - SHA-256 hash
   - retrieval timestamp
   - note that files are provider-native RDS files served by ILO/Rilostat bulk endpoints
4. If R is available, read the RDS files and record dimensions/column names for each data table. If R is not available, do not install packages just to parse RDS; preserve byte/hash/header evidence and explicitly state that row-level inspection was deferred.
5. Update `/data/datasets/econ/dataset_briefing.md` and `/data/datasets/econ/docs/public-datasets/briefings/econ.md` by preserving the full existing briefing and adding one new bullet under `# Data Inventory`:
   - `raw/ilostat_core_labor_20260531/`: describe the four files, exact bytes, hashes, HTTP metadata, and coverage: ILOSTAT annual employment counts, unemployment rates, and labour-force participation rates by sex and age, from official ILO/Rilostat bulk endpoints, adding international labor-market coverage.
   - Make clear this improves but does not complete ILOSTAT coverage; remaining gaps include broader ILOSTAT topics and frequencies, metadata/dictionaries beyond the selected files, and restricted/credentialed labor microdata.
6. Update the roadmap line for labor/international data so it no longer says ILOSTAT is entirely absent; it should say a core ILOSTAT annual labor-market slice is present while broader ILOSTAT coverage remains incomplete.

## Hard preservation requirements

Do not replace the full econ briefing with a short source-only briefing. Before finalizing, verify the full briefing still contains these existing inventory markers:

- `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
- `raw/worldbank/WDI_CSV_2026_04_09.zip`
- `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
- `raw/world_bank_wdi_20260409/`
- `raw/imf_weo_202604/`
- `raw/sec_edgar_bulk/`
- `raw/hmda_2024_snapshot/`
- `raw/ilostat_core_labor_20260531/`

If any marker is missing, repair the briefing from the checked-in full copy before finishing.

## Required artifacts

Write all of the following in `/data/datasets/econ/` and ensure they are non-empty:

- `dataset_briefing.md`
- `improvement_result.json`
- `work.md`
- `report.html`

`improvement_result.json` must be valid JSON and include:

```json
{
  "status": "completed",
  "datasetId": "econ",
  "added": ["raw/ilostat_core_labor_20260531/"],
  "evidence": [
    {
      "path": "raw/ilostat_core_labor_20260531/table_of_contents_en.rds",
      "sha256": "..."
    }
  ]
}
```

The `evidence` array must be non-empty and include every downloaded provider file. Do not use `Startup placeholder` or `startup_placeholder_not_final` anywhere in the final artifacts.

Also copy artifacts to `$RESULT_DIR` as required by the execution contract. Include `result.json` too if the local convention in this worker uses it.

## Final response

Report the ILOSTAT directory added, downloaded files, byte counts, and whether RDS row-level inspection was available. Do not claim the econ dataset now has literally all data an economist could need; state that this is one more concrete gap closed.
