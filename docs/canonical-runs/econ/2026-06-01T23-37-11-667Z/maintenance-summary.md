# Econ canonical maintenance summary

- Execution: `b0b45397-cf92-4a16-81a6-f2b4f8cb9c51`
- Prompt: `docs/canonical-runs/econ/2026-06-01T23-37-11-667Z/improve-prompt.md`
- Target gap: ONS labour productivity reference tables.
- Result: ONS labour productivity PRDY workbook landed on the canonical volume under `raw/ons_labour_productivity_20260519/`.
- Source: `https://www.ons.gov.uk/file?uri=/employmentandlabourmarket/peopleinwork/labourproductivity/datasets/labourproductivity/current/prdy.xlsx`
- File evidence: `prdy.xlsx`, 172,672 bytes, SHA-256 `45b7b3ff4269d2cb3890e350cfe9bf8ef58fb73ba30f75eeb5e5ac8dc062ddb9`, HTTP 200, provider release published 2026-05-19.
- Coverage evidence: workbook `data` sheet has 332 quarterly observations from 1961 through 2025 Q4 across 136 productivity indicators, including output per worker, output per job, output per hour, labour input, industry SIC07 splits, and ancillary ratios.
- Validation note: the remote execution reached `ready` and profile readback pointed at this execution, but `npm run canonical:dataset -- validate --dataset-id econ --execution-id b0b45397-cf92-4a16-81a6-f2b4f8cb9c51` blocked because the immutable remote `dataset_briefing.md` artifact omitted older required inventory markers. The checked-in full briefing was repaired from concrete artifact evidence and the live profile was resynced from that full briefing.
- Remaining gaps: broader ONS productivity packages, industry multifactor productivity, jobs/hours API feeds, productivity microdata, balance of payments/IIP, regional accounts, Blue Book revision histories, broader ONS API/catalog coverage, and other roadmap families remain incomplete.
