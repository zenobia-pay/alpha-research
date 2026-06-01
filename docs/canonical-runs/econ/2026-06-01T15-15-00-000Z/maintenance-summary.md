# ILOSTAT Labor Ingestion Attempt Summary

- Execution id: `53cb2bd7-46ee-4401-a05b-92ca979657c1`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/53cb2bd7-46ee-4401-a05b-92ca979657c1`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/53cb2bd7-46ee-4401-a05b-92ca979657c1/artifacts`
- Final execution status: `failed`
- Validation status: not run; primary artifacts were missing.

## What Happened

The worker verified the dataset mount and then attempted several official ILOSTAT bulk/API paths, including:

- `https://webapps.ilo.org/ilostat-files/WEB_bulk_download/indicator/table_of_contents_en.csv`
- `https://webapps.ilo.org/ilostat-files/WEB_bulk_download/indicator/UNE_TUNE_SEX_AGE_RT_A.csv.gz`
- `https://webapps.ilo.org/ilostat-files/WEB_bulk_download/datasets/UNE_TUNE_SEX_AGE_RT_A.zip`
- `https://rplumber.ilo.org/files/indicator/EAP_TEAP_SEX_AGE_NB_A.csv.gz`
- `https://sdmx.data.ilo.org/rest/dataflow`

The run found official ILOSTAT SDMX documentation and two visible dataflows (`DF_SDG_GLH`, `DF_IMF_ILOSTAT`), but the candidate indicator files either returned 404 HTML, zero-byte payloads, or metadata-only responses during this execution. No valid ILOSTAT source file was written under `raw/ilostat/`.

## Validation Result

The execution failed the remote artifact gate:

- `Remote agent run completed without required primary artifact: dataset_briefing.md`
- `path_added: none`
- `profile_updated: false`

The CLI-visible econ profile remains validated from repair run `b4608049-dda2-4441-a5a7-c1552ced28d1`.

## Follow-Up

Do not retry ILOSTAT until valid current bulk/API data URLs are proven. Continue filling the economist coverage roadmap with compact official sources that have stable downloadable artifacts, then revisit ILOSTAT with a dedicated endpoint discovery run if needed.
