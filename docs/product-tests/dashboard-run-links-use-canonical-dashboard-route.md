# dashboard run links use canonical dashboard route

## Product Use

The product gives users dashboard links for runs.

## Why This Test

This keeps every run link copyable and reliable across product surfaces. If link shape drifts, users lose the fastest path from CLI output to the run page.

## Actions Taken

The dashboard URL builder is called for a run id.

## Assertions Made

- The generated link uses the canonical dashboard route.
- The link includes the run id query parameter.
- The link includes the run id fragment.
