# Census CBP 2023 Maintenance Summary

- Execution id: `77d8d2f5-4559-4816-8af2-d11127554b80`
- Target: `raw/census_cbp_2023/`
- Source: official Census CBP dataset page `https://www.census.gov/data/datasets/2023/econ/cbp/2023-cbp.html` and CBP record-layout pages.
- Result: data landed on the canonical volume, but the execution's final `dataset_briefing.md` and `improvement_result.json` remained startup placeholders, so canonical validation blocked on artifacts/profile.
- Profile repair: checked-in briefing and backend profile were repaired from transcript evidence and official Census HEAD checks.

Verified volume evidence from the remote transcript:

- Files present: `cbp23us.zip`, `cbp23st.zip`, `cbp23pr_ia_st.zip`, `cbp23csa.zip`, `cbp23msa.zip`, `cbp23co.zip`, `cbp23pr_ia_co.zip`, `zbp23totals.zip`, `zbp23detail.zip`, `cbp23cd.xlsx`, plus `metadata.json`, `inventory.csv`, `inventory_members.json`, and `source_notes.md`.
- ZIP row counts: 5,281,174 total rows across nine ZIP files.
- Row details: county 1,100,961; CSA 206,367; MSA 576,818; Puerto Rico/island county equivalent 16,953; Puerto Rico/island state 10,639; state 348,204; U.S. 12,162; ZIP detail 2,974,116; ZIP totals 34,954.
- Official HEAD checks from `www2.census.gov/programs-surveys/cbp/datasets/2023/` showed 52,250,690 bytes across the ten provider files and Census Last-Modified headers on June 26, 2025.
