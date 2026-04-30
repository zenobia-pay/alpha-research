# run debug bundle redacts session token and includes remote evidence

## Product Use

An engineer asks for a debug bundle for a run.

## Actions Taken

The product builds one bundle containing version information, redacted session metadata, dashboard links, tracked-run state, run payloads, events, results, and artifacts.

## Assertions Made

- The generated timestamp is stable in the test.
- The session token is redacted.
- The full token is not present anywhere in the bundle.
- The dashboard URL points at the requested run.
- Events and run evidence are included.
