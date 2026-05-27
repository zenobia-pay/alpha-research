# Modal Deployment

Alpha Research remote work is backend-owned and runs on Modal-backed workers. The repository does not keep provider secrets locally; the backend owns Modal, canonical dataset volumes, object storage for logs/artifacts, and catalog credentials.

## Runtime Shape

- Durable Modal volumes store canonical public dataset roots.
- Object storage stores run logs and artifacts.
- Postgres stores dataset catalog state, run/event state, artifact metadata, and version pointers.
- Modal runners execute refresh, expansion, improvement, ingest, and analysis jobs with named resource profiles.
- API and frontend builds are produced from this repo and deployed by the external hosting workflow.

## Remote Execution Kinds

`kind` is the backend/Modal job contract, not the local script name. Keep this list small because the backend may use it to choose dataset mount mode, writer locks, resource policy, lifecycle labels, and artifact handling.

| Kind | Use | Dataset volume |
| --- | --- | --- |
| `dataset-improvement` | Canonical dataset writes: add/repair raw public data, refresh briefing/profile, or run a simplified maintenance prompt. | writable `write-version` mount |
| `dataset-refresh` | Scheduled canonical refresh over existing public-source packages. | writable `write-version` mount |
| `dataset-bootstrap-repair` | Repair a canonical dataset stuck in bootstrap/provisioning state. | writable `write-version` mount |
| `dataset-expansion` | Plan or stage expansion candidates before a full write pass. | writable when it will persist candidate/provenance artifacts |
| `dataset-disk-audit` | Inspect inventory/profile proof without source expansion. | read-oriented unless the audit explicitly repairs inventory/profile artifacts |
| `manual` | Ad hoc admin remote-agent execution. | no canonical write guarantees unless resources/metadata request them |

Do not create new `kind` values for local launcher variants such as "simple maintenance." Use an existing backend kind, usually `dataset-improvement`, and put local mode details in metadata such as `canonicalMaintenanceMode: "simple"`.

## Resource Profiles

| Profile | CPU | Memory | Scratch | Use |
| --- | ---: | ---: | ---: | --- |
| `briefing` | 2 | 4GiB | 20GiB | dataset documentation and profile reads |
| `canonical-public` | 4 | 8GiB | 50GiB | `econ` public source refreshes and expansion planning |
| `standard-analysis` | 8 | 16GiB | 100GiB | normal analysis and transformation runs |
| `large-ingest` | 8 | 16GiB | 500GiB | explicit large backfills after size estimation |

## Local Readiness

Run these before shipping deployment-facing changes:

```bash
npm run build
npm run deploy:check
```

`deploy:check` verifies the local API/frontend build artifacts and this Modal deployment note. Real deployments are handled outside this repository.
