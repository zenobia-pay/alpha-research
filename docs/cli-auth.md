# CLI Auth Contract

The `alpha-research` CLI now supports browser-based login, but the web product still needs to implement the matching auth endpoint.

## CLI Behavior

Running:

```bash
alpha-research login
```

does this:

1. starts a local callback listener on `127.0.0.1`
2. opens `${ALPHA_RESEARCH_WEB_ORIGIN}/cli/login?...`
3. waits for a redirect back to:

```text
http://127.0.0.1:<port>/cli/callback?state=<state>&token=<session-token>
```

4. stores the returned token in:

```text
~/.alpha-research/session.json
```

## Required Web Endpoint

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

## Notes

- This is currently a lightweight session handoff, not a full OAuth authorization code flow.
- If you want a stricter production model later, convert this to:
  - auth code
  - PKCE
  - token exchange against an API endpoint

For now, the important property is a single `alpha-research` account system shared across deployed research terminals and the local CLI.
