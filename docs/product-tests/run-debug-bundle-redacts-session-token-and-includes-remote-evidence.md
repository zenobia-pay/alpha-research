# run debug bundle redacts session token and includes remote evidence

## Product Use

An engineer asks for a debug bundle for a run.

## Why This Test

This makes failures debuggable without leaking credentials. Engineers need enough run evidence to diagnose problems while preserving session-token safety.

## Actions Taken

The product builds one bundle containing version information, redacted session metadata, dashboard links, tracked-run state, run payloads, events, results, and artifacts.

## Assertions Made

- The generated timestamp is stable in the test.
- The session token is redacted.
- The full token is not present anywhere in the bundle.
- The dashboard URL points at the requested run.
- Events and run evidence are included.
