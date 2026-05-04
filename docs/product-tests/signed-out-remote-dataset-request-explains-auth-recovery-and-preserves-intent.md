# signed-out remote dataset request explains auth recovery and preserves intent

## Product Use

A signed-out user asks to show remote datasets.

## Why This Test

This protects the auth boundary. The product should explain how to sign in and preserve the request without exposing session internals or pretending remote data is available.

## Actions Taken

The agent receives the remote dataset request without a saved session and answers locally.

## Assertions Made

The response asks the user to sign in with `/login` or `research login`, repeats the original request for continuity, and avoids token, session-file, working-state, or fake dataset language.
