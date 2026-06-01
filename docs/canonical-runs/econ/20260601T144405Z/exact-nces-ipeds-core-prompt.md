Improve the canonical `econ` dataset with official National Center for Education Statistics IPEDS complete data files.

This is a canonical dataset maintenance job for dataset id `econ`. Do not run a user research analysis. Add provider-native source files, checksums, row/member inventory, and concise documentation so the dataset profile can truthfully describe this coverage.

Official source page:
- https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx?rtid=1

Required files to download and preserve under `raw/nces_ipeds_2024_core/`:
- `HD2024.zip` from `https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip`
- `HD2024_Dict.zip` from `https://nces.ed.gov/ipeds/datacenter/data/HD2024_Dict.zip`
- `IC2024.zip` from `https://nces.ed.gov/ipeds/datacenter/data/IC2024.zip`
- `IC2024_Dict.zip` from `https://nces.ed.gov/ipeds/datacenter/data/IC2024_Dict.zip`
- `EFFY2024.zip` from `https://nces.ed.gov/ipeds/datacenter/data/EFFY2024.zip`
- `EFFY2024_Dict.zip` from `https://nces.ed.gov/ipeds/datacenter/data/EFFY2024_Dict.zip`
- `C2024_A.zip` from `https://nces.ed.gov/ipeds/datacenter/data/C2024_A.zip`
- `C2024_A_Dict.zip` from `https://nces.ed.gov/ipeds/datacenter/data/C2024_A_Dict.zip`
- `C2024_B.zip` from `https://nces.ed.gov/ipeds/datacenter/data/C2024_B.zip`
- `C2024_B_Dict.zip` from `https://nces.ed.gov/ipeds/datacenter/data/C2024_B_Dict.zip`
- `C2024_C.zip` from `https://nces.ed.gov/ipeds/datacenter/data/C2024_C.zip`
- `C2024_C_Dict.zip` from `https://nces.ed.gov/ipeds/datacenter/data/C2024_C_Dict.zip`
- `C2024DEP.zip` from `https://nces.ed.gov/ipeds/datacenter/data/C2024DEP.zip`
- `C2024DEP_Dict.zip` from `https://nces.ed.gov/ipeds/datacenter/data/C2024DEP_Dict.zip`

Verified HTTP metadata locally on 2026-06-01 for the core data files:
- `HD2024.zip`: HTTP 200, content length `1088372`, last modified `Sun, 21 Sep 2025 20:40:58 GMT`.
- `IC2024.zip`: HTTP 200, content length `135305`, last modified `Sun, 21 Sep 2025 20:41:04 GMT`.
- `EFFY2024.zip`: HTTP 200, content length `3643893`, last modified `Sun, 21 Sep 2025 20:40:52 GMT`.
- `C2024_A.zip`: HTTP 200, content length `4680679`, last modified `Sun, 21 Sep 2025 20:40:37 GMT`.
- `C2024_B.zip`: HTTP 200, content length `250396`, last modified `Sun, 21 Sep 2025 20:40:37 GMT`.
- `C2024_C.zip`: HTTP 200, content length `377227`, last modified `Sun, 21 Sep 2025 20:40:38 GMT`.
- `C2024DEP.zip`: HTTP 200, content length `1440373`, last modified `Sun, 21 Sep 2025 20:40:39 GMT`.

For each downloaded file:
- Record URL, HTTP status, content type, last-modified header, byte count, and SHA256.
- Verify ZIP integrity.
- Inventory ZIP members with compressed/uncompressed sizes.
- For CSV data members, count rows and columns by streaming from the ZIP without extracting the full files into many small files.
- For dictionary files, record member names and enough metadata to prove field definitions are present.
- Add a small metadata JSON file in the same raw directory with the facts above.

Documentation/profile update requirements:
- Update `docs/public-datasets/briefings/econ.md`, `docs/public-datasets/econ.mdx`, and the dataset profile metadata to include NCES IPEDS core coverage.
- Describe this as IPEDS 2024 directory, institutional characteristics, 12-month enrollment, completions/awards, and CIP/distance-education completions coverage for U.S. postsecondary institutions.
- Retain existing notes about remaining gaps. In particular, mention that this does not replace all NCES products, K-12 CCD/EDGE data, student-level restricted-use files, longitudinal BPS/B&B/HSLS/NELS studies, College Scorecard, or historical IPEDS vintages beyond this selected 2024 core slice.
- Preserve the existing disk inventory proof fields and set/update the inventory/provenance fields for this execution.

Return a short maintenance summary including file counts, byte counts, row counts, checksums, and any skipped or inaccessible files.
