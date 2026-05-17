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

## Start A Canonical Admin Improvement Job

Use this workflow when the user asks to improve a canonical dataset such as `econ`. This is an admin-owned canonical job, not a user-facing `research` run.

1. Check the npm scripts before choosing an execution path:
   - `npm run canonical:improve` starts bulk canonical improvement jobs through `/api/admin/canonical-datasets/improve`.
   - `CANONICAL_DATASET_IDS=econ npm run canonical:improve:dry-run` verifies the filtered bulk job shape.
   - `npm run canonical:dataset -- status --dataset-id econ` verifies Modal-volume write availability, active writer locks, inventory proof, and CLI profile readback state. Do not treat legacy `status` / `deploymentStatus` alone as the canonical write gate.
   - `npm run remote-agent:exec -- --kind dataset-improvement --dataset-id econ --prompt-file <file>` is the admin-owned fallback when the canonical-datasets admin endpoint rejects a dataset that the CLI registry can see.
2. Never use `/api/cli/datasets/:datasetId/runs`, `research --prompt`, or other user-facing run paths for canonical improvement jobs.
3. Target one dataset with `CANONICAL_DATASET_IDS=<id>` when the request names one dataset. Do not launch all canonical datasets by accident.
4. Preserve the exact operator prompt under `docs/canonical-runs/<dataset-id>/<timestamp>/`. Use a specific filename such as `admin-improvement-prompt.md` when the generic template is not the right fit.
5. Make the prompt explicit about canonical constraints:
   - admin-owned canonical improvement job;
   - mounted dataset volume, preferably `DATASET_MOUNT_PATH`;
   - raw public source package only;
   - no merged panels, derived fields, cross-source joins, or analysis-ready artifacts;
   - candidate classification and provenance requirements;
   - required artifacts, docs mirrors, profile update/readback, and Slack briefing behavior.
6. If the bulk or single-dataset canonical endpoint returns `404 {"error":"Canonical dataset not found"}` but `npm run canonical:dataset -- status --dataset-id <id>` shows the dataset record exists and `improvable: true`, use `remote-agent:exec` with `--kind dataset-improvement --dataset-id <id>` and the exact prompt file. This remains an admin execution, not a user-facing run.
7. After launch, capture:
   - execution id;
   - admin status URL;
   - artifacts URL;
   - initial status and output preview.
8. Poll the admin status endpoint with the admin token, not the CLI run debugger:

   ```bash
   node - <<'NODE'
   import { readAdminToken, defaultOrigin } from './scripts/admin-remote-agent.mjs'
   const executionId = '<execution-id>'
   const response = await fetch(new URL(`/api/admin/remote-agent-executions/${executionId}`, defaultOrigin), {
     headers: { Authorization: `Bearer ${readAdminToken()}` },
   })
   const body = await response.json()
   const execution = body.execution ?? body.remoteAgentExecution
   console.log(JSON.stringify({
     id: execution?.id,
     status: execution?.status,
     outputPreview: execution?.outputPreview,
     artifactCount: execution?.artifactCount,
     updatedAt: execution?.updatedAt,
     lastEvents: (body.events ?? []).slice(-5).map((event) => ({
       level: event.level,
       message: event.message,
       createdAt: event.createdAt,
     })),
   }, null, 2))
   NODE
   ```
9. If you changed scripts, prompts, or docs while launching the job, run focused tests such as `npm run test:canonical`, then commit and push. Per repo policy, also run `npm run deploy:check` after completing the change.

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
