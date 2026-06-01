# CFTC Broader Report Families Maintenance Summary

- Execution id: `275c0c63-0203-4ebf-9353-71e1687043df`
- Target: `raw/cftc_cot_broader_report_families_2020_2026/`
- Source: official CFTC historical compressed text ZIP URLs from `https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm`
- Result: remote transcript verified 42 downloaded ZIPs, zero download errors, six report families, and seven years per family for 2020-2026.
- Caveat: the execution reached `ready`, but canonical validation blocked because `dataset_briefing.md` and the profile briefing were startup placeholders. The checked-in public briefing and backend profile were repaired from the verified transcript facts rather than from the placeholder artifacts.

Family coverage:

- `legacy_futures_only`: `deacotYYYY.zip`, 7 files, 13,538,622 compressed bytes.
- `legacy_futures_options_combined`: `deahistfoYYYY.zip`, 7 files, 13,887,414 compressed bytes.
- `disaggregated_futures_options_combined`: `com_disagg_txt_YYYY.zip`, 7 files, 14,385,162 compressed bytes.
- `tff_futures_only`: `fut_fin_txt_YYYY.zip`, 7 files, 3,379,835 compressed bytes.
- `tff_futures_options_combined`: `com_fin_txt_YYYY.zip`, 7 files, 3,416,046 compressed bytes.
- `cit_supplement`: `dea_cit_txt_YYYY.zip`, 7 files, 596,685 compressed bytes.
