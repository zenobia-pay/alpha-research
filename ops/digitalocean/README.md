# DigitalOcean Deployment

Recommended production layout for `alpha-research`:

## Topology

- `alpha-research-data` DigitalOcean Volume
  - mounted at `/srv/alpha-research/data`
  - stores `data/instances/<instance-id>/instance.json`
- `alpha-research-api` droplet
  - runs the API/orchestrator process
  - mounts the volume read-only or read-mostly
- `alpha-research-ingest` droplet
  - optional worker for scheduled ingest or large normalization jobs
  - mounts the same volume read-write
- `alpha-research-frontend` droplet or static host
  - serves the built frontend assets
  - points browser traffic at the API origin

## Why This Shape

This repo is file-backed today. A mounted volume is the cleanest way to:

- keep API nodes stateless
- let ingest jobs write large bundle outputs once
- avoid shipping multi-gigabyte datasets into container images
- support dataset refreshes without rebuilding the app tier

## Runtime Paths

- code checkout: `/srv/alpha-research/repo`
- dataset bundles: `/srv/alpha-research/data/instances`
- frontend build output: `/srv/alpha-research/repo/apps/frontend/dist`

## Environment

API:

```bash
PORT=8787
DATASET_INSTANCE_ROOT=/srv/alpha-research/data/instances
```

Frontend:

```bash
VITE_API_BASE_URL=https://api.example.com
```

## Services

Use the systemd units in `ops/digitalocean/systemd/` as a starting point.

## Deploy Process

1. Sync repo code to the droplet.
2. Mount the DigitalOcean volume at `/srv/alpha-research/data`.
3. Run ingest locally or on the ingest droplet to create/update bundles in `/srv/alpha-research/data/instances`.
4. Build and restart the API.
5. Build and deploy the frontend.

For larger recurring refreshes, the ingest droplet should own normalization and write bundles onto the shared volume, while the API droplet only reads them.

