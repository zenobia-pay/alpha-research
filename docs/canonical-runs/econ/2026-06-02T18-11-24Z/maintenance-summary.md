# Econ Freddie Mac PMMS Seed

- Dataset: `econ`
- Execution: `07dcaa21-f937-467e-97d6-323e39bfcb3b`
- Admin status: `https://alpharesearch.nyc/api/admin/remote-agent-executions/07dcaa21-f937-467e-97d6-323e39bfcb3b`
- Prompt: `docs/canonical-runs/econ/2026-06-02T18-11-24Z/freddie-mac-pmms-prompt.md`
- Launcher prompt copy: `docs/canonical-runs/econ/2026-06-02T18-11-54-174Z/improve-prompt.md`

The execution reached `ready` and landed the official Freddie Mac PMMS workbook under `raw/freddie_mac_pmms_20260602/historicalweeklydata.xlsx`.

Evidence from remote artifacts:

- Source URL: `https://www.freddiemac.com/pmms/docs/historicalweeklydata.xlsx`
- HTTP status: 200
- Content type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Content length / saved size: 218,060 bytes
- Last-Modified: `Thu, 28 May 2026 13:49:14 GMT`
- SHA-256: `8418e2ba0261c463f9ff496bdc7707b826dbffd5347b0b91a3089b8265fda98c`
- Inventory evidence: 2,880 weekly observations from 1971-04-02 through 2026-05-28, with 30-year fixed, 15-year fixed, 5/1 ARM, points, margin, and spread fields.

`npm run canonical:dataset -- validate --dataset-id econ --execution-id 07dcaa21-f937-467e-97d6-323e39bfcb3b` blocked because the remote-captured required artifacts and backend profile were still startup placeholders and omitted older mandatory inventory markers. The checked-in full briefing was updated from concrete PMMS artifact evidence, and the backend profile was manually resynchronized from the full checked-in briefing with this execution id as `volumeInventoryRunId`.
