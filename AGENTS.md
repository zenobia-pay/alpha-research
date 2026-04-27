# Alpha Research Agent Guide

This repo contains the RESEARCH CLI and the dataset substrate it operates over. Use this file as the first stop for agent work.

## Repo Map

- `apps/cli`: the `research` CLI, Assistant UI TUI, tool registry, auth/session handling, tracked runs, and debug commands.
- `apps/api`: local API for serving normalized dataset instances.
- `apps/frontend`: local dataset explorer frontend.
- `apps/ingest`: local normalizer for tabular and unstructured datasets.
- `packages/core`: dataset records, query, aggregation, and text projection contracts.
- `packages/storage`: sharded manifest loading and local instance storage.
- `packages/fixture`: small demo datasets for deterministic local testing.
- `ops/digitalocean`: production service notes for the DigitalOcean API/frontend stack.

## Important CLI Entry Points

- `apps/cli/src/index.ts`: command dispatch for `research`, `research --prompt`, `research login`, scripted commands, and `research debug run`.
- `apps/cli/src/interactive.tsx`: Assistant UI / Ink TUI adapter, slash commands, polling active tracked runs.
- `apps/cli/src/agent.ts`: agent loop, system instructions, runtime dependency seam, tool implementations.
- `apps/cli/src/tool-registry.ts`: stable exported registry metadata and validation surface for harness tests.
- `apps/cli/src/remote.ts`: authenticated backend API client.
- `apps/cli/src/runs.ts` and `apps/cli/src/run-watcher.ts`: local tracked-run store and background polling.

## Common Commands

```bash
npm install
npm run build
npm run typecheck
npm run test
npm run test:cli
npm run test:golden
npm run harness:check
npm run dev:cli
npm run cli -- --prompt "show remote datasets"
```

For deterministic CLI tests, use an isolated session directory:

```bash
RESEARCH_SESSION_DIR=.tmp/research-test RESEARCH_DISABLE_RUN_WATCHER=1 npm run test:cli
```

## Debug Workflow

When a remote run fails or appears stuck:

1. Get the run id from the CLI or dashboard URL.
2. Run `research debug run <run-id>`.
3. If you need a file, run `research debug run <run-id> --output /tmp/research-run-debug.json`.
4. Inspect `remote.run`, `remote.results`, `remote.events`, `remote.artifacts`, and `trackedRun`.

The debug command redacts the session token and uses the saved CLI session. It should be the first diagnostic step before guessing about DigitalOcean, dashboard, or remote-agent failures.

## Engineering Rules

- Preserve `research`, `research help`, and `research --prompt "<prompt>"` behavior.
- Do not require a local `OPENAI_API_KEY` for normal CLI agent turns; model calls go through the backend.
- Keep deterministic tests offline. Live Alpha Research or DigitalOcean checks must be explicit opt-in smoke tests.
- Keep tool schemas serializable and validate them with `npm run harness:check`.
- If a change touches run lifecycle semantics, update `docs/RUN_LIFECYCLE.md`.
- If a change moves CLI concepts or entry points, update `docs/ARCHITECTURE.md` and this file.

## Related Docs

- `docs/ARCHITECTURE.md`: system map and data flow.
- `docs/RUN_LIFECYCLE.md`: remote run states and ownership rules.
- `docs/HARNESS.md`: deterministic harness and golden test details.
- `docs/cli-auth.md`: browser login and remote API contract.
- `docs/storage-architecture.md`: sharded dataset package and production storage direction.
