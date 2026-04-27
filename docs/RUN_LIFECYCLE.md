# Remote Run Lifecycle

Remote runs are backend-owned jobs that operate on dataset-backed cloud environments. The CLI starts, tracks, cancels, and debugs runs, but the backend owns cloud provisioning, DigitalOcean volume attachment, remote agent execution, and artifact persistence.

## Statuses

Canonical statuses:

- `queued`: accepted by the backend but not yet assigned infrastructure.
- `booting`: droplet or pooled runner is being prepared.
- `running`: remote agent or script is executing.
- `ready` / `completed` / `succeeded`: terminal success. The user-facing label should be "completed successfully".
- `failed` / `error`: terminal failure. Events/logs must explain the failure.
- `cancelled` / `canceled`: terminal cancellation.

The CLI treats terminal statuses through `isTerminalRunStatus` in `apps/cli/src/runs.ts`.

## Ownership Rules

- The backend is the source of truth for run status, events, artifacts, and volume locks.
- The CLI's tracked-run file is only a local cache for user feedback and polling.
- A dataset volume may be held by one active run at a time. A backend `409` active-run conflict should produce a clear message with the blocking run id and dashboard URL.
- Cancelling a run should update backend state and release the volume lock when cleanup completes.

## CLI Start Flow

1. The agent chooses an async run-start tool such as `query_remote_dataset`, `aggregate_remote_dataset`, or `create_research_environment`.
2. The tool calls the backend to create the run.
3. The CLI records the run in the tracked-run store with dashboard URL and prompt.
4. The CLI returns immediately unless the user explicitly asked to wait.
5. The TUI poller and background watcher update status and recent event messages.

## Waiting Flow

If the user asks to wait, the agent can expose `wait_for_run_completion`. That tool streams new events with backoff and fetches final results once a terminal status is reached or the timeout expires.

## Results Flow

`get_run_results` should show:

- original prompt
- human-readable status
- structured result summary when available
- artifact names with plain explanations
- dashboard link
- concrete follow-up suggestions grounded in the result

Raw JSON should be avoided in normal responses unless the user explicitly asks for it.

## Failure Debugging

A failed run must have enough persisted evidence to debug:

- lifecycle events
- remote agent transcript or equivalent logs
- produced and requested artifact metadata
- run prompt and config
- droplet/runner identifier when available
- terminal error message

Use:

```bash
research debug run <run-id>
research debug run <run-id> --output /tmp/research-run-debug.json
```

The debug bundle is the agent-readable object to inspect before making lifecycle changes.

## Stale Runs

Avoid complicated degraded-state fallbacks in the CLI. Stale detection belongs in the backend lifecycle manager because the backend controls volume locks and cloud cleanup. The CLI can display stale-looking local tracked runs, but it should not locally mark a remote run failed without backend confirmation.
