# Symphony Automation

This repo is configured for OpenAI Symphony with `WORKFLOW.md` at the repository root. Linear is the source of truth. Issues in the `Alpha Research` Linear project with status `Todo` or `In Progress` are eligible for automatic Codex work.

## One Command

```bash
npm run symphony:start
```

`npm run symphony:start` performs the full local startup path:

1. Verifies `WORKFLOW.md`, `LINEAR_API_KEY`, `git`, `npm`, `codex`, and `mise`.
2. Verifies the configured Linear project and `Todo` state.
3. Installs `mise` through Homebrew if it is missing.
4. Clones or updates `openai/symphony` under `.tmp/openai-symphony`.
5. Runs the upstream Symphony setup/build through `mise`.
6. Creates `~/code/alpha-research-workspaces`.
7. Starts Symphony with this repo's `WORKFLOW.md`.

## Create a Smoke Issue and Start

```bash
export LINEAR_API_KEY=...
npm run symphony:start -- --seed --title "Symphony smoke test: docs no-op"
```

This creates a small `Todo` issue in the `Alpha Research` project, then starts Symphony. Symphony should pick up the issue, create a workspace, clone the repo, launch `codex app-server`, and let the agent follow the prompt in `WORKFLOW.md`.

## Useful Commands

```bash
npm run symphony:doctor
npm run symphony:bootstrap
npm run symphony:seed -- --title "Small CLI fix"
npm run symphony:start
```

Environment variables:

- `LINEAR_API_KEY`: required for Linear polling and issue seeding. The wrapper loads this from `.env.local` when present.
- `ALPHA_RESEARCH_REPO_URL`: optional clone URL for issue workspaces. Defaults to `https://github.com/zenobia-pay/alpha-research.git`.
- `SYMPHONY_DIR`: optional upstream Symphony checkout path. Defaults to `.tmp/openai-symphony`.
- `GIT_AUTHOR_NAME` and `GIT_AUTHOR_EMAIL`: optional per-workspace Git identity. Defaults to `Codex <codex@users.noreply.github.com>`.

## Linear Configuration

- Project: `Alpha Research CLI`
- Project slug: `27b5ad2a438f`
- Active states: `Todo`, `In Progress`
- Handoff state: `In Review`
- Terminal states: `Done`, `Canceled`, `Cancelled`, `Duplicate`

## Expected Agent Behavior

The `WORKFLOW.md` prompt tells the agent to:

- Treat Linear as the source of truth.
- Move `Todo` issues to `In Progress`.
- Maintain one `## Codex Workpad` comment.
- Create a branch from the Linear branch name or `codex/<issue-id>`.
- Implement, validate, commit, push, and open or update a PR.
- Move the issue to `In Review` only after validation and PR handoff are complete.
