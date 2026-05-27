# Modal Deployment

Alpha Research remote work is backend-owned and runs on Modal-backed workers. The repository does not keep provider secrets locally; the backend owns Modal, canonical dataset volumes, object storage for logs/artifacts, and catalog credentials.

## Runtime Shape

- Durable Modal volumes store canonical public dataset roots.
- Object storage stores run logs and artifacts.
- Postgres stores dataset catalog state, run/event state, artifact metadata, and version pointers.
- Modal runners execute refresh, expansion, improvement, ingest, and analysis jobs with named resource profiles.
- API and frontend builds are produced from this repo and deployed by the external hosting workflow.

## Remote Execution Kinds

`kind` is the backend/Modal runtime contract, not the local script name. Keep it small because the backend may use it to choose dataset mount mode, writer locks, resource policy, lifecycle labels, and artifact handling.

| Kind | Use | Dataset volume |
| --- | --- | --- |
| `dataset-improvement` | Any canonical dataset write job: improvement, refresh, bootstrap repair, expansion artifact staging, briefing/profile repair, or simplified maintenance. | writable `write-version` mount |
| `manual` | Ad hoc admin remote-agent execution. | no canonical write guarantees unless resources/metadata request them |

Do not create new `kind` values for local launcher variants such as "simple maintenance", "refresh", "expansion", or "bootstrap repair." Use `kind: "dataset-improvement"` for canonical dataset writes and put the local workflow in metadata such as `operation: "refresh"` or `canonicalMaintenanceMode: "simple"`.

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
