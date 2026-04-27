# Harness Engineering For RESEARCH CLI

The RESEARCH CLI harness makes agent behavior inspectable, deterministic, and safe to evolve. It follows the core harness-engineering principle that useful agent work depends on the surrounding tools, tests, docs, and observability, not just the model prompt.

## Local Harness Commands

```bash
npm run harness:check
npm run test:cli
npm run test:golden
npm run build
npm run typecheck
```

`harness:check` validates:

- required agent-facing docs exist
- tool registry names, descriptions, schemas, and JSON serialization
- canonical dashboard run URL generation
- no normal CLI harness path requires a local `OPENAI_API_KEY`

## Deterministic Test Rules

CLI harness tests must not call the real Alpha Research API, OpenAI, DigitalOcean, or the user's real session directory.

Use:

```bash
RESEARCH_SESSION_DIR=.tmp/research-test RESEARCH_DISABLE_RUN_WATCHER=1 npm run test:cli
```

The tests inject `AgentRuntimeDeps` into `runAgentTurn`, replacing the remote client and session reader with fakes. This keeps the model/tool loop testable without network access.

## Golden Transcripts

Golden fixtures live under `apps/cli/test/golden`.

Each fixture defines:

- prompt
- fake backend `/api/cli/respond` payload
- fake remote data/run payloads
- expected tool-call sequence
- expected user-facing summary fragments

Golden tests should cover durable user workflows:

- list remote datasets
- create a local-file dataset
- create a mixed public/private research environment
- retrieve the result of the last run
- cancel an active run
- handle auth refresh or backend active-run conflicts

## Runtime Seams

`AgentRuntimeDeps` is the main harness seam:

- `createRemoteClient`: inject fake backend behavior.
- `readSession`: isolate session state.
- `login`: test auth-expiry behavior without opening a browser.
- `createToolRegistry`: constrain tools for targeted tests.

Do not add broad mocks around the TUI. Prefer testing `runAgentTurn`, registry validation, scripted command behavior, and one non-interactive CLI smoke path.

## Debug Bundles

Use `research debug run <run-id>` for run failures. It emits a redacted JSON object with:

- CLI version and Node version
- redacted session metadata
- dashboard run URL
- tracked-run cache entry
- backend run payload
- results payload
- events payload
- artifacts payload

This bundle is intended for agents and engineers to debug failures without screenshots or manual dashboard inspection.

## Live Smoke Tests

Live tests against `alpharesearch.nyc` and DigitalOcean should be explicit manual smoke tests with real credentials. They do not belong in default CI because they are slower, stateful, and depend on external infrastructure.
