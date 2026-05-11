# Modal Deployment

Alpha Research remote work is backend-owned and runs on Modal-backed workers. The repository does not keep provider secrets locally; the backend owns Modal, object storage, and catalog credentials.

## Runtime Shape

- Object storage stores canonical dataset versions, run logs, and artifacts.
- Postgres stores dataset catalog state, run/event state, artifact metadata, and version pointers.
- Modal runners execute refresh, expansion, improvement, ingest, and analysis jobs with named resource profiles.
- API and frontend builds are produced from this repo and deployed by the external hosting workflow.

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
