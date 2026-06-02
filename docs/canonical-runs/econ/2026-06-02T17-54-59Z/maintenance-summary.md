# Econ FFIEC Call Report Seed

- Dataset: `econ`
- Execution: `a57912c9-3c96-4113-9acf-0b09ba9b97e3`
- Admin status: `https://alpharesearch.nyc/api/admin/remote-agent-executions/a57912c9-3c96-4113-9acf-0b09ba9b97e3`
- Prompt: `docs/canonical-runs/econ/2026-06-02T17-54-59Z/ffiec-call-report-prompt.md`
- Launcher prompt copy: `docs/canonical-runs/econ/2026-06-02T17-55-27-361Z/improve-prompt.md`

The execution reached `ready` and landed two provider-native FFIEC CDR Call Report all-schedules ZIP files under `raw/ffiec_call_report_20260602/`:

- `FFIEC CDR Call Bulk All Schedules 03312026.zip`: 5,480,052 bytes; SHA-256 `ca69f7115a2db92ccc66390875131f353995b59e74406895ab2cfc7b1c122b68`
- `FFIEC CDR Call Bulk All Schedules 12312025.zip`: 6,407,735 bytes; SHA-256 `4f18765b13f5ef6d05fb12cc7ce3f9a99f2c018984bc234a29bbe7fb24e9fe0a`

Evidence from the remote artifacts showed HTTP 200 responses from `https://cdr.ffiec.gov/public/PWS/DownloadBulkData.aspx`, 48 text members per ZIP, and representative row checks including 4,335 POR rows for the 2026-03-31 package.

`npm run canonical:dataset -- validate --dataset-id econ --execution-id a57912c9-3c96-4113-9acf-0b09ba9b97e3` initially blocked because the remote-captured `dataset_briefing.md` and profile briefing were narrowed and omitted older mandatory inventory markers (`raw/federal_reserve_z1/z1_csv_files_20260319.zip`, `raw/worldbank/WDI_CSV_2026_04_09.zip`, and `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`). The checked-in full briefing was updated from concrete FFIEC artifact evidence, and the backend profile was manually resynchronized from the full checked-in briefing with this execution id as `volumeInventoryRunId`.

Post-sync readback showed `disk_proven`, `writeReady: true`, `sourceBullets: 98`, no startup placeholder text, the new `raw/ffiec_call_report_20260602` marker, and the older Z1/WDI/BIS CPMI markers preserved.
