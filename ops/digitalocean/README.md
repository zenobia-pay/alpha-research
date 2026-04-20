# DigitalOcean Deployment

Recommended production layout for `alpha-research`:

## Topology

- object storage bucket
  - canonical home for dataset manifests, Parquet partitions, and text-projection shards
- managed Postgres
  - dataset catalog
  - shard inventory
  - implementation and deployment metadata
- `alpha-research-qdrant` droplet
  - local NVMe volume
  - Qdrant collection storage
- `alpha-research-api` droplet
  - serves the API and orchestrator
  - maintains a local package cache under `/srv/alpha-research/cache`
- `alpha-research-ingest` droplet
  - optional worker for scheduled ingest, normalization, and backfills
- `alpha-research-frontend` droplet or static host
  - serves the built frontend assets
  - points browser traffic at the API origin

## Why This Shape

For large datasets, a shared mounted volume is the wrong canonical store. The better split is:

- object storage for durability and cheap large artifacts
- Postgres for catalog queries and metadata joins
- Qdrant on local NVMe for fast vector retrieval
- stateless API nodes with only a local cache

## Runtime Paths

- code checkout: `/srv/alpha-research/repo`
- local package cache: `/srv/alpha-research/cache/instances`
- frontend build output: `/srv/alpha-research/repo/apps/frontend/dist`

## Environment

API:

```bash
PORT=8787
DATASET_INSTANCE_ROOT=/srv/alpha-research/cache/instances
DATASET_OBJECT_STORE_URL=s3://alpha-research-datasets
DATASET_CATALOG_URL=postgres://...
QDRANT_URL=http://alpha-research-qdrant:6333
```

Frontend:

```bash
VITE_API_BASE_URL=https://api.example.com
```

## Services

Use the systemd units in `ops/digitalocean/systemd/` as a starting point.

## Deploy Process

1. Sync repo code to the droplet.
2. Build and deploy the frontend.
3. Build and restart the API.
4. Run ingest on the ingest droplet.
5. Publish the resulting package artifacts into object storage.
6. Warm the API cache for the datasets you expect to serve heavily.

## Signed-In CLI Flow

The Worker-backed `research` CLI now targets this remote path:

1. register dataset metadata with `alpharesearch.nyc`
2. request a pre-signed Spaces upload URL
3. upload the raw source file directly from the CLI
4. call deploy
5. Alpha Research provisions or reuses a dataset volume
6. Alpha Research launches a one-off ingest droplet with the volume attached
7. the droplet downloads the raw file, runs `normalize_dataset.py`, and writes the normalized package to the mounted volume
8. the droplet reports run events and final manifest location back to the Alpha Research Worker

Required Worker secrets for this path:

- `DIGITALOCEAN_API_TOKEN`
- `DO_SPACES_BUCKET`
- `DO_SPACES_REGION`
- `DO_SPACES_ACCESS_KEY_ID`
- `DO_SPACES_SECRET_ACCESS_KEY`
- `RESEARCH_INTERNAL_RUNNER_TOKEN`

## Current Repo Status

Today the repo already supports:

- sharded local packages with `manifest.json`
- lazy API reads from a local package cache
- storage profiles that describe the intended production backend split

The next production step is direct object-store and Postgres integration in the read path so the API does not depend on filesystem discovery alone.
