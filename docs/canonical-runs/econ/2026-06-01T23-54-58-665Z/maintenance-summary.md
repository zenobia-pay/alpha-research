# Econ Canonical Maintenance Summary

- Dataset: `econ`
- Execution: `f3c42bfa-9aab-458c-94de-7b79c00f56ca`
- Admin status: https://alpharesearch.nyc/api/admin/remote-agent-executions/f3c42bfa-9aab-458c-94de-7b79c00f56ca
- Prompt record: `docs/canonical-runs/econ/2026-06-01T23-54-58-665Z/improve-prompt.md`
- Result: blocked for intended ONS BoP/IIP work.

This launch passed a path to the detailed field brief rather than the field brief body, so the remote worker could not read the local prompt file and drifted into a generic Treasury debt-to-the-penny attempt. Canonical validation blocked the run because `dataset_briefing.md` and the profile briefing were still startup placeholders and were missing required existing econ inventory markers.

The live dataset profile was restored from the full checked-in briefing and pointed back to the previous disk-proven run `b0b45397-cf92-4a16-81a6-f2b4f8cb9c51` before relaunching the ONS target with the prompt body inline.
