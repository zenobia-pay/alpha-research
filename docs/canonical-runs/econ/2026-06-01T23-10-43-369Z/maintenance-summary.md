# Econ canonical maintenance summary

- Execution: `4abcc612-e958-4be0-b150-a6e15e33cd04`
- Prompt: `docs/canonical-runs/econ/2026-06-01T23-10-43-369Z/improve-prompt.md`
- Target gap: ONS labour-market overview coverage.
- Result: ONS Summary of labour market statistics / table A01 workbook landed on the canonical volume under `raw/ons_labour_market_overview_20260601/`.
- Source: `https://www.ons.gov.uk/file?uri=/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/datasets/summaryoflabourmarketstatistics/current/a01may2026.xls`
- File evidence: `a01may2026.xls`, 3,805,184 bytes, SHA-256 `4759826c6b904de03e4bc26532dc2dda4f651281406427e5f96d3074bc74e9e5`, HTTP 200, content type `application/vnd.ms-excel;charset=utf-8`, weak ETag `W/"fcfd99e37ca11887fd629c9601ab48b3fe7210f3--gzip"`.
- Coverage evidence: workbook inspection found 25 sheets. Key sheets include 660 quarterly period rows from Jan-Mar 1971 through Jan-Mar 2026, 406-row three-month rolling series from Mar-May 1992 through Jan-Mar 2026, 298-row series from Apr-Jun 2001 through Feb-Apr 2026, and one monthly sheet with 1,140 detected rows from January 1931 through December 2025.
- Validation note: the remote execution reached `ready`, but the immutable `dataset_briefing.md` artifact and live profile were left as startup placeholders. The checked-in full briefing was repaired from concrete transcript evidence and the live profile was resynced from that full briefing.
- Remaining gaps: broader ONS labour subtables/vintages, labour microdata, trade, productivity, balance of payments/IIP, regional accounts, Blue Book revision histories, broader ONS API/catalog coverage, and other roadmap families remain incomplete.
