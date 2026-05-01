# Alpha Research Codex Plugin

This repo-bundled plugin makes Alpha Research available inside Codex threads as a product-level command center for:

- dataset intake from local, public, API, export, and mixed sources
- dataset navigation, readiness, trust, profiles, and limitations
- research design from fuzzy intent into concrete study plans
- research operations for remote runs, artifacts, cancellation, recovery, and follow-up decisions

The plugin reuses the existing RESEARCH CLI session and Alpha Research dashboard API. It does not require local OpenAI, DigitalOcean, or dashboard secrets.

## Files

- `.codex-plugin/plugin.json`: Codex plugin metadata
- `.mcp.json`: stdio MCP server registration
- `mcp/server.js`: MCP tools over the existing CLI remote client
- `skills/alpha-research/SKILL.md`: product behavior guidance for Codex

## Local Smoke Test

Build the repo first so the plugin can import the CLI runtime:

```bash
npm run build
```

Then verify the MCP handshake:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | node plugins/alpha-research/mcp/server.js
```

The server reads the saved `research login` session from the normal CLI session directory. Tool outputs redact token-like fields before returning data to Codex.
