# CLI Auth And Remote API Contract

The `research` CLI now has two layers:

- browser-based sign-in
- an Ink-based interactive agent shell that manages local and remote datasets

The browser handoff endpoint exists. What still needs server implementation is the authenticated remote dataset and run API that the agent calls after sign-in.

## CLI Behavior

Running:

```bash
research login
```

does this:

1. starts a local callback listener on `127.0.0.1`
2. opens `${ALPHA_RESEARCH_WEB_ORIGIN:-https://alpharesearch.nyc}/cli/login?...`
3. waits for a redirect back to:

```text
http://127.0.0.1:<port>/cli/callback?state=<state>&token=<session-token>
```

4. stores the returned token in:

```text
~/.research/session.json
```

## Required Browser Handoff Endpoint

The website should implement:

```text
GET /cli/login
```

Query params:

- `state`
- `redirect_uri`
- `client`

Expected behavior:

1. ensure the user is signed in on `alpha-research`
2. mint a CLI-scoped session token for that account
3. redirect the browser to:

```text
<redirect_uri>?state=<state>&token=<session-token>
```

## Required Remote Dataset API

After login succeeds, the CLI expects authenticated JSON endpoints such as:

```text
GET  /api/cli/me
GET  /api/cli/datasets
POST /api/cli/datasets
POST /api/cli/datasets/:datasetId/deploy
GET  /api/cli/runs
POST /api/cli/datasets/:datasetId/runs
```

The current CLI uses those endpoints for:

- listing remote datasets
- registering a new dataset from a local manifest/package
- kicking off deployments
- starting remote research runs

## Notes

- This is currently a lightweight session handoff, not a full OAuth authorization code flow.
- If you want a stricter production model later, convert this to:
  - auth code
  - PKCE
  - token exchange against an API endpoint

For now, the important property is a single `alpha-research` account system shared across deployed research terminals and the local CLI.
