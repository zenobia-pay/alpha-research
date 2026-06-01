# Econ Coverage Roadmap Update

- Dataset: `econ`
- Change type: read-only planning and documentation update
- Reason: continue moving the canonical economics dataset toward the long-term target of covering the public and license-gated source families economists commonly need, while the Modal volume is inode-saturated.

## Current Evidence

The checked-in public inventory now proves a 27G raw economics substrate with major coverage across Federal Reserve Z.1/FRED, BEA regional and NIPA files, Census ACS/CPS/AHS/CBP/ASM/BFS/BDS, BLS QCEW/ATUS, BIS CBS/LBS/CPMI, FHFA, Treasury, IMF WEO, World Bank WDI/IDS/Findex/GFDD, Penn World Table, OECD MEI/SNA/QNA, Eurostat HICP, Zillow, and related packages.

The 2026-06-01 capacity audit found the blocking operational constraint:

- Byte capacity: 382G free on `/__modal/volumes`.
- Dataset size: 27G.
- Inodes: 499,998 used out of 500,000, leaving 2 free.

This makes new ingestion unsafe until inode quota or file-count pressure is repaired.

## Roadmap Added

The public dataset briefing and canonical catalog now state that "all data an economist could need" is an open-ended coverage target rather than a current factual claim. They identify missing or incomplete source families across:

- Macro and vintage releases.
- Labor, household, and demographic microdata.
- Public finance, tax, and transfer systems.
- Firm, industry, filings, and market structure.
- Credit, banking, mortgages, and financial markets.
- Housing and real estate.
- International trade, agriculture, labor, and development.

The catalog source registry was expanded with active/deferred targets including ALFRED, Federal Reserve statistical releases, ECB, HMDA, CFPB, SEC EDGAR, CFTC COT, USDA NASS/ERS, IRS SOI, SSA, NCES, ILOSTAT, UN Comtrade, WTO, FAOSTAT, IPUMS, ICPSR, and WRDS/CRSP/Compustat.

## Next Action

Repair econ volume inode capacity before provider downloads. After that, the highest-value next ingestion should prioritize compact provider-native archives or APIs that fill clear gaps without exploding file counts, especially ALFRED/Federal Reserve releases, HMDA, IRS SOI, SEC EDGAR submissions metadata, CFTC COT, ILOSTAT, UN Comtrade, and USDA NASS/ERS.
