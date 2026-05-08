# RESEARCH CLI Architecture

The RESEARCH CLI is a local agent shell for creating and operating remote research environments. It does not run model calls with a local OpenAI key. The CLI sends planning requests to the Alpha Research backend, executes returned tool calls locally, and starts remote agent runs on cloud environments.

## Main Loop

`apps/cli/src/index.ts` is the executable entry point.

- `research` starts the Assistant UI / Ink TUI in `apps/cli/src/interactive.tsx`.
- `research --prompt "<text>"` runs one non-interactive agent turn.
- `research prompt "<text>"` is equivalent to `--prompt`.
- Slash commands in the TUI, such as `/login`, `/logout`, `/cancel`, `/exit`, bypass the model loop when possible.

The TUI uses `useLocalRuntime` from Assistant UI. User messages flow into `runAgentTurn` in `apps/cli/src/agent.ts`, and emitted tool/assistant messages are streamed back into the thread.

## Agent Runtime

`runAgentTurn` owns the iterative Responses-style loop:

1. Build the available tool schemas from the registry.
2. Send instructions, user input, previous response id, and tool schemas to `/api/cli/respond`.
3. Execute any returned tool calls.
4. Send tool outputs back to `/api/cli/respond`.
5. Stop when the backend returns assistant text or when an async run-start tool returns immediately.

The agent runtime has an `AgentRuntimeDeps` seam so tests can inject fake sessions, fake remote clients, and fake tool registries without touching real user state or the network.

## Tool Registry

The executable tools are implemented in `apps/cli/src/agent.ts`. The stable harness-facing metadata surface is `apps/cli/src/tool-registry.ts`.

Core tool groups:

- Auth and session: `login`.
- Local datasets: local deletion remains available for explicit delete requests; local file intake is handled through `create_research_environment`.
- Remote dataset/environment: `list_remote_datasets`, `inspect_remote_dataset`, `describe_remote_dataset`, and `create_research_environment`.
- Research/run operations: `start_research_run`, `start_research_run`, `start_research_run`, `start_research_run`, transform/labeling tools.
- Run management: `list_tracked_runs`, `get_run_results`, `list_run_artifacts`, `wait_for_run_completion`, `cancel_remote_run`.

Async run-start tools return immediately unless the user explicitly asks to wait. The CLI then records the run locally and starts or relies on polling to update activity.

## Remote API

`apps/cli/src/remote.ts` wraps the backend API. Important endpoints:

- `/api/cli/respond`: backend-hosted model loop.
- `/api/cli/datasets`: catalog list/create.
- `/api/cli/datasets/:datasetId/runs`: start remote agent/query/analysis runs.
- `/api/cli/runs/:runId/results`: run status, events, artifacts, and metadata.
- `/api/cli/sessions/:sessionId/entries`: dashboard terminal-session log persistence.

The backend is responsible for using platform secrets and provisioning cloud infrastructure. The CLI should not require DigitalOcean or OpenAI secrets locally.

## Remote Environment Shape

Datasets are normalized onto DigitalOcean volumes. Remote agent runs attach or operate against dataset-backed cloud environments. Different run types can request different droplet sizes, but from the CLI perspective a run is a cataloged backend object with:

- run id
- dataset id
- status
- prompt
- events/logs
- artifacts/results
- dashboard URL

## Observability

The CLI writes tracked runs under `RESEARCH_SESSION_DIR` or `~/.research`. The TUI polls active runs and shows color-coded activity. For deep debugging, `research debug run <run-id>` fetches run state, events, artifacts, tracked-run state, and redacted session context into one JSON bundle.
