---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "27b5ad2a438f"
  active_states:
    - Todo
    - In Progress
  terminal_states:
    - Done
    - Canceled
    - Cancelled
    - Duplicate
polling:
  interval_ms: 10000
workspace:
  root: ~/code/alpha-research-workspaces
hooks:
  after_create: |
    git clone "${ALPHA_RESEARCH_REPO_URL:-https://github.com/zenobia-pay/alpha-research.git}" .
    git config user.name "${GIT_AUTHOR_NAME:-Codex}"
    git config user.email "${GIT_AUTHOR_EMAIL:-codex@users.noreply.github.com}"
    npm install
  before_run: |
    git status --short --branch
  after_run: |
    git status --short --branch
agent:
  max_concurrent_agents: 3
  max_turns: 20
codex:
  command: codex --config shell_environment_policy.inherit=all --config 'model="gpt-5.3-codex"' --config model_reasoning_effort=high app-server
  approval_policy: never
  thread_sandbox: workspace-write
  turn_sandbox_policy:
    type: workspaceWrite
---
You are working on a Linear issue for the Alpha Research CLI repository.

Issue:
- Identifier: {{ issue.identifier }}
- Title: {{ issue.title }}
- Current state: {{ issue.state }}
- URL: {{ issue.url }}
- Labels: {{ issue.labels }}
- Branch: {{ issue.branch_name }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

{% if attempt %}
Continuation context:
- This is retry/continuation attempt #{{ attempt }}.
- Resume from the existing workspace state. Do not restart completed investigation or validation unless the code changed.
{% endif %}

Operating model:
1. Treat Linear as the source of truth. Start by reading the current issue state, title, description, labels, links, and comments.
2. If the issue is `Todo`, move it to `In Progress` before code work.
3. Maintain one persistent Linear workpad comment headed `## Codex Workpad`; update that comment throughout the run instead of posting separate progress comments.
4. Use the repository's AGENTS.md and docs as mandatory local instructions.
5. Pull the latest default branch before editing. Work in the issue workspace only.
6. Create a branch named from the Linear branch name when available, otherwise `codex/{{ issue.identifier | downcase }}`.
7. Implement the smallest correct change for the issue. Do not expand scope; create a separate Backlog issue for meaningful follow-up work.
8. Keep deterministic tests offline. Do not require local `OPENAI_API_KEY` for normal CLI agent turns.
9. Run focused validation first, then the broad gate when the change touches shared CLI/API/frontend/deployment behavior.
10. Before handoff, commit, push, and open or update a GitHub PR. Attach the PR link to the Linear issue when tooling permits.
11. Move the issue to `In Review` only after code is pushed, validation is green, PR feedback has been checked, and the workpad accurately reflects completed acceptance criteria and validation.
12. If blocked by missing credentials, permissions, or unavailable external services, update the workpad with a concise blocker brief and leave the issue in `In Progress` unless the issue clearly needs human review.

Required repo validation:
- Narrow code changes: run the nearest relevant test or typecheck.
- CLI/runtime/tooling changes: run `npm run test:cli`.
- Broad CLI, API, frontend, harness, docs, or deployment changes: run `npm run agent:check`.
- If the repository has a real deployment workflow for the touched surface, run the deploy after validation.

Quality bar:
- Preserve `research`, `research help`, and `research --prompt "<prompt>"`.
- Keep tool schemas serializable and validated by `npm run harness:check`.
- Update `docs/RUN_LIFECYCLE.md` for run lifecycle semantic changes.
- Update `docs/ARCHITECTURE.md` and AGENTS.md when CLI concepts or entry points move.
- Do not revert user or unrelated workspace changes.
- Final handoff should include commit SHA, PR URL, validation run, and any residual risk in the workpad.
