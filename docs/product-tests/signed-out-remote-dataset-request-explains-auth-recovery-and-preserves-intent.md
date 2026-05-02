# signed-out remote dataset request explains auth recovery and preserves intent

## Product Use

A signed-out user asks to view remote datasets. The product should not attempt remote catalog calls without a session, and it should preserve the user's original intent so the same request can be retried after login.

## Why This Test

Remote catalog access depends on authentication. A confusing auth failure would make onboarding feel broken, especially for users who do not know whether the CLI is local-only or connected to Alpha Research.

## Actions Taken

The harness runs a remote dataset request without a saved session and observes the assistant response.

## Assertions Made

The response explains that sign-in is required, gives a concrete login recovery path, repeats the original request for retry, and avoids leaking local session filenames, token details, or misleading progress messages.
