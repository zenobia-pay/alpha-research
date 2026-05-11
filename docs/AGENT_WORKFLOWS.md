# Agent Workflows

Use these recipes when changing this repository. Keep them short and update them when the code moves.

## Change A CLI Tool

1. Read `apps/cli/src/agent.ts` for the executable tool and `apps/cli/src/tool-registry.ts` for the exported metadata surface.
2. Update or add deterministic tests in `apps/cli/test/agent-harness.test.ts` or `apps/cli/test/golden.test.ts`.
3. If the behavior is a durable user workflow, add a fixture in `apps/cli/test/golden/`.
4. Run `npm run test:cli` and `npm run harness:check`.

## Change Run Lifecycle Semantics

1. Read `docs/RUN_LIFECYCLE.md`, `apps/cli/src/runs.ts`, `apps/cli/src/run-watcher.ts`, and result handling in `apps/cli/src/agent.ts`.
2. Update terminal status handling and user-facing status wording together.
3. Add deterministic coverage for the lifecycle path.
4. Update `docs/RUN_LIFECYCLE.md`.
5. Run `npm run test:cli`, `npm run docs:check`, and `npm run harness:check`.

## Debug A Failed Remote Run

1. Get the run id from the CLI or dashboard.
2. Run `research debug run <run-id>`.
3. If the output is large, run `research debug run <run-id> --output /tmp/research-run-debug.json`.
4. Inspect `remote.run`, `remote.results`, `remote.events`, `remote.artifacts`, and `trackedRun` before changing code.

## Add A Golden Test

1. Create a JSON fixture in `apps/cli/test/golden/`.
2. Include the user prompt, fake backend response, fake remote payloads, expected tool call sequence, and summary fragments.
3. Keep the fixture offline and deterministic.
4. Run `npm run test:golden`.

## Change Dataset Fixtures

1. Inspect `packages/fixture/src/index.ts` and `data/instances/`.
2. Keep fixtures small enough for fast deterministic tests.
3. Update package tests if the fixture shape changes.
4. Run `npm run test -w @rprend/alpha-fixture` and `npm run smoke:local`.

## Change Frontend Explorer Behavior

1. Read `apps/frontend/src/App.tsx` and `apps/frontend/src/styles.css`.
2. Keep API assumptions aligned with `apps/api/src/server.ts`.
3. Build the frontend and run the local smoke check.
4. Run `npm run build -w @rprend/alpha-frontend` and `npm run smoke:local`.

## Prepare A Deploy

1. Run `npm run build`.
2. Run `npm run deploy:check`.
3. Read `ops/modal/README.md` and the external deploy workflow notes for the touched surface.
4. Only run a real deploy when a deploy workflow exists and the current change targets that deployed surface.
