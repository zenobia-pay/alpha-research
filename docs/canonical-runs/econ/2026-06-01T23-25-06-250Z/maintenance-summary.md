# Econ canonical maintenance summary

- Execution: `5353a7bb-39e8-40bb-978e-52ba3c1fe0a9`
- Prompt: `docs/canonical-runs/econ/2026-06-01T23-25-06-250Z/improve-prompt.md`
- Target gap: ONS UK trade goods and services publication tables.
- Result: ONS UK trade publication tables workbook landed on the canonical volume under `raw/ons_trade_20260601/`.
- Source: `https://www.ons.gov.uk/file?uri=/economy/nationalaccounts/balanceofpayments/datasets/uktradegoodsandservicespublicationtables/current/tradepublicationtables2026mar.xlsx`
- File evidence: `tradepublicationtables2026mar.xlsx`, 6,791,001 bytes, SHA-256 `cad9c5f68e329bced9a98ac7fb3422a9fc7d0c19b484d01a74479cca06d05957`, HTTP 200.
- Coverage evidence: workbook retains 21 analytical tables plus cover/notes sheets with monthly, quarterly, and annual current-price trade flows, chained-volume measures, implied deflators, rolling three- and twelve-month aggregates, revisions, top 50 partner countries, top 30 commodities, and UK trade in oil. Value tables report seasonally adjusted pound-million flows from January 1997 through March 2026; volume indices use 2019=100.
- Validation note: the remote execution reached `ready` and profile readback pointed at this execution, but `npm run canonical:dataset -- validate --dataset-id econ --execution-id 5353a7bb-39e8-40bb-978e-52ba3c1fe0a9` blocked because the immutable remote `dataset_briefing.md` artifact omitted older required inventory markers. The checked-in full briefing was repaired from concrete artifact evidence and the live profile was resynced from that full briefing.
- Remaining gaps: ONS trade API endpoints and historical trade vintages, detailed trade microdata, productivity accounts, balance of payments/IIP, regional accounts, Blue Book revision histories, broader ONS API/catalog coverage, and other roadmap families remain incomplete.
