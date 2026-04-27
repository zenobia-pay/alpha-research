# Harness Engineering For RESEARCH CLI

The RESEARCH CLI harness makes agent behavior inspectable, deterministic, and safe to evolve. It follows the core harness-engineering principle that useful agent work depends on the surrounding tools, tests, docs, and observability, not just the model prompt.

## Local Harness Commands

```bash
npm run agent:check
npm run harness:check
npm run test:cli
npm run test:golden
npm run build
npm run typecheck
npm run docs:check
npm run architecture:check
npm run smoke:local
npm run deploy:check
```

`harness:check` validates:

- required agent-facing docs exist
- tool registry names, descriptions, schemas, and JSON serialization
- canonical dashboard run URL generation
- no normal CLI harness path requires a local `OPENAI_API_KEY`

`agent:check` is the canonical full local gate. It runs build, typecheck, tests, harness validation, docs consistency, architecture boundaries, local API smoke, and deployment readiness checks.

`docs:check` validates that agent-facing docs are present, linked paths exist, documented npm scripts exist, and run lifecycle statuses stay aligned with `apps/cli/src/runs.ts`.

`architecture:check` enforces workspace dependency boundaries and keeps `apps/cli/src/tool-registry.ts` metadata-only.

`smoke:local` starts the local API against fixture instances and verifies health, instance listing, and bootstrap payloads.

`deploy:check` validates DigitalOcean service files and confirms built API/frontend artifacts exist after `npm run build`.

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
- handle failed run results with diagnostic guidance
- handle wait-for-run-completion timeout
- create public-data environments

## Product Workflow Success Case

`apps/cli/test/agent-harness.test.ts` includes a product-level success contract for an econ research hypothesis workflow:

```text
Make me an econ dataset with all necessary econ datasets for a housing-cycle hypothesis,
then wait until complete and show me the results and artifacts.
```

The success case proves the CLI can orchestrate the full promised workflow against hermetic remote fakes:

1. inspect existing remote datasets
2. create a research environment with a concrete acquisition plan
3. require source coverage for FRED, Fannie Mae, FHFA, BLS, BEA, Census, and Treasury
4. require normalization, source URLs, row counts, missingness, join-key, and coverage validation
5. wait for the environment build run to complete
6. create a structured research spec with subset, shaping, labeling, and artifact requirements
7. run the transformation script for a county-month analysis panel
8. run the labeling job with an explicit market-regime labeling prompt
9. run the hypothesis analysis with requested table, chart, and markdown artifacts
10. wait for the analysis run and retrieve final artifacts

This is still a hermetic product workflow test. It validates the CLI orchestration contract and the shape of the plan/results without calling live public data APIs, Alpha Research production, OpenAI, or DigitalOcean.

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
