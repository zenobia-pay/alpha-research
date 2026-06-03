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

Prefer direct Modal volume control for mechanical canonical data work when the local Modal profile can access the relevant volume. In this workspace, `modal volume list` exposes `agent-dataset`, and the econ dataset root is `/datasets/econ` inside that volume. Use `modal volume ls agent-dataset /datasets/econ`, `modal volume get agent-dataset /datasets/econ/<path> <local-dest>`, and `modal volume put -f agent-dataset <local-path> /datasets/econ/<path>` for file inspection and repair before launching a remote Codex worker. For large files, avoid downloading full archives locally just to verify them; use small mounted metadata, run artifacts, or a live `modal container exec <container-id> -- <command>` while the relevant container is active. Remote admin executions are still useful for backend-owned writer locks and audit trails, but do not use a remote Codex worker as the default way to edit docs, repair placeholders, or inspect mounted files when direct Modal volume operations are available.

For small public-source additions that need code execution on the mounted volume, prefer a direct `modal run` script. `scripts/modal-add-econ-bea-regional-county-gdp.py`, `scripts/modal-add-econ-bls-ces-ce.py`, `scripts/modal-add-econ-bls-cpi-cu.py`, `scripts/modal-add-econ-bls-eci-ci.py`, `scripts/modal-add-econ-cftc-cot-older-history.py`, `scripts/modal-add-econ-eia-electricity-survey-detail.py`, `scripts/modal-add-econ-eia-seds.py`, `scripts/modal-add-econ-eia-open-data-bulk.py`, `scripts/modal-add-econ-bls-laus-bulk.py`, `scripts/modal-add-econ-bls-cps-ln.py`, `scripts/modal-add-econ-ffiec-call-history.py`, `scripts/modal-add-econ-ffiec-ubpr-history.py`, `scripts/modal-add-econ-hmda-2007-historic.py`, `scripts/modal-add-econ-hmda-2008-historic.py`, `scripts/modal-add-econ-hmda-2009-historic.py`, `scripts/modal-add-econ-hmda-2010-historic.py`, `scripts/modal-add-econ-hmda-2011-historic.py`, `scripts/modal-add-econ-hmda-2012-historic.py`, `scripts/modal-add-econ-hmda-2013-historic.py`, `scripts/modal-add-econ-hmda-2014-historic.py`, `scripts/modal-add-econ-hmda-2015-historic.py`, `scripts/modal-add-econ-hmda-2016-historic.py`, `scripts/modal-add-econ-hmda-2017-snapshot.py`, `scripts/modal-add-econ-hmda-2018-snapshot.py`, `scripts/modal-add-econ-hmda-2019-snapshot.py`, and `scripts/modal-add-econ-hmda-2020-snapshot.py` are reusable examples: they mount `agent-dataset`, write under `/datasets/econ/raw/`, update `manifest.json`, commit the Modal volume, and return compact evidence for briefing/profile sync. If a provider blocks direct downloads from Modal, use local official-source download plus `modal volume put -f`, then run a Modal finalizer that recomputes mounted-volume hashes and updates the manifest.

1. Check the npm scripts before choosing an execution path:
   - `npm run canonical:improve` starts bulk canonical improvement jobs through `/api/admin/remote-agent-executions`.
   - `CANONICAL_DATASET_IDS=econ npm run canonical:improve:dry-run` verifies the filtered bulk job shape.
   - `npm run canonical:dataset -- status --dataset-id econ` verifies Modal-volume write availability, active writer locks, inventory proof, and CLI profile readback state. Do not treat legacy `status` / `deploymentStatus` alone as the canonical write gate.
   - `npm run canonical:dataset -- improve --dataset-id econ --field-brief <brief>` starts a single dataset-improvement remote execution.
   - Inside the remote worker, require an actual create/delete probe in the dataset root before downloads or profile work. `test -w` can report writable on a read-only Modal mount; a failed `touch`/write probe must block the run as `dataset_dir_not_writable` or the exact non-secret filesystem error.
2. Use the admin remote-agent execution endpoint as the product contract for maintenance launches. Do not use `/api/cli/datasets/:datasetId/runs`, `research --prompt`, or other user-facing run paths.
3. Target one dataset with `CANONICAL_DATASET_IDS=<id>` when the request names one dataset. Do not launch all canonical datasets by accident.
4. Preserve the exact operator prompt under `docs/canonical-runs/<dataset-id>/<timestamp>/`. Use a specific filename such as `admin-improvement-prompt.md` when the generic template is not the right fit.
5. Make the prompt explicit about canonical constraints:
   - admin-owned canonical improvement job;
   - mounted dataset volume, preferably `DATASET_MOUNT_PATH`;
   - raw public source package only;
   - no merged panels, derived fields, cross-source joins, or analysis-ready artifacts;
   - candidate classification and provenance requirements;
   - required artifacts, docs mirrors, profile update/readback, and Slack briefing behavior.
6. If `npm run canonical:improve` or `npm run canonical:dataset -- improve` does not submit an admin remote-agent execution for an existing improvable dataset, fix the launcher.
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
9. After the execution reaches a terminal state, validate it before syncing docs or claiming success:

   ```bash
   npm run canonical:dataset -- validate --dataset-id <dataset-id> --execution-id <execution-id>
   ```

   Treat a validation failure as blocked even when the remote final summary says completed. The validator requires required artifacts, `disk_proven` status, and profile readback tied to the same execution id.
10. Treat worker lifecycle failures such as `.remote-agent/state/status.json.tmp` rename errors as platform execution failures even if `dataset_briefing.md` can be recovered from artifacts or the mounted volume. Recovery may preserve useful output, but it is not a successful canonical run unless the canonical endpoint reports terminal success and profile readback is proven through `npm run canonical:dataset -- validate --dataset-id <id> --execution-id <execution-id>`.
11. Treat startup placeholder artifacts as blockers even when the remote execution reports `ready` and the profile run id matches. Placeholder text such as `Startup placeholder` or `startup_placeholder_not_final` in `dataset_briefing.md`, `improvement_result.json`, or `briefingMarkdown` means the run did not produce a real disk inventory. Restore the prior checked-in disk-proven profile before continuing, then record the run as blocked.
12. Report the result as a compact status card, not a wide table. Put the user-facing answer in this order:
   - one sentence stating whether the run completed, blocked, or failed;
   - a short "What happened" list with dataset id, execution id, prompt record, admin status link, and validation result;
   - a short "Why it matters" line that says whether docs/profile were updated or intentionally left unchanged;
   - a short "Next action" line;
   - a narrow evidence table with at most three columns: `Check`, `Result`, `Evidence`.

   Example blocked report:

   ```md
   Econ maintenance blocked: the remote execution ended before producing required artifacts, so docs/profile were not updated from this run.

   **What Happened**
   - Dataset: `econ`
   - Execution: `70e5cdea-a5d2-445e-8df5-f5f4d8bbddb8`
   - Prompt: `docs/canonical-runs/econ/<timestamp>/improve-prompt.md`
   - Admin status: <https://alpharesearch.nyc/api/admin/remote-agent-executions/<id>>
   - Validation: blocked

   **Why It Matters**
   The CLI profile remains `disk_proven` from the prior successful run; this execution did not replace it.

   **Next Action**
   Fix the remote-run blocker, then rerun `canonical:dataset -- improve` and validate the new execution.

   | Check | Result | Evidence |
   |---|---|---|
   | Remote execution | failed | missing `report.html` |
   | Required artifacts | missing | `dataset_briefing.md`, `improvement_result.json` |
   | Profile readback | unchanged | prior run id still present |
   ```

   Do not use a wide table with columns like `dataset id`, `status`, `prompt path`, `run id`, `dashboard link`, `briefing recovered`, `docs updated`, `CLI profile updated`, `readback status`, and `blocker`; it wraps badly and hides the actual failure.
12. If you changed scripts, prompts, or docs while launching the job, run focused tests such as `npm run test:canonical`, then commit and push. Per repo policy, also run `npm run deploy:check` after completing the change.

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
