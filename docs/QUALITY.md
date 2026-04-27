# Alpha Research Quality Rules

This document captures engineering taste that should compound through agents, tests, and scripts. Prefer turning repeated review feedback into a check under `scripts/`.

## Default Gate

Run the full agent readiness gate before shipping repository changes:

```bash
npm run agent:check
```

This command builds every workspace, typechecks, runs deterministic tests, validates the CLI harness, checks docs, checks architecture boundaries, runs a local API smoke test, and verifies deployment readiness.

## Agent-First Rules

- Keep `AGENTS.md` short and map-like. Put deeper context in `docs/`.
- Keep repository knowledge versioned. Important product, architecture, run lifecycle, and debugging facts belong in markdown or executable checks, not chat.
- Prefer deterministic harness tests over live checks. Live Alpha Research, OpenAI, or DigitalOcean tests must be explicit opt-in smoke tests.
- Preserve the normal CLI path without requiring a local `OPENAI_API_KEY`.
- Add or update golden tests when changing durable CLI behavior.
- Update `docs/RUN_LIFECYCLE.md` when run status semantics or ownership rules change.
- Update `docs/ARCHITECTURE.md` and `AGENTS.md` when CLI entry points or workspace responsibilities move.

## Tooling Rules

- Tool schemas must remain JSON-serializable and stable enough for golden tests.
- Tool descriptions should explain when the tool is useful, not merely restate the name.
- Normal user-facing CLI responses should be human-readable. Avoid raw JSON dumps unless the user asks for raw output.
- Debug output must redact access tokens and include enough context for an agent to diagnose the failure.

## Architecture Rules

- `packages/core` is the lowest-level contract package and must not depend on other Alpha workspaces.
- `packages/storage` may depend on `packages/core` and `packages/implementations`.
- Apps may depend on packages, but app packages should not import each other.
- `apps/cli/src/tool-registry.ts` should stay a stable metadata/export surface. Runtime tool implementations live in `apps/cli/src/agent.ts`.
- Cross-workspace imports should use package names, not relative paths.

## Deployment Rules

- Production service files should run built artifacts, not TypeScript source files.
- Deployment docs must identify required environment variables and build commands.
- If a real deployment workflow exists for the touched service, agents should run it after completing and validating the change.
