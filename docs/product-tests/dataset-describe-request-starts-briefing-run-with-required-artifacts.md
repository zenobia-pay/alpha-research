# dataset describe request starts briefing run with required artifacts

## Product Use

A user asks the product to describe the `econ` dataset.

## Why This Test

This protects the dataset-description workflow as a documentation product. A describe request should produce inventory, readiness, trust, limitation, and profile artifacts, not drift into ad hoc analysis or suggestions.

## Actions Taken

The product starts a dataset briefing run for `econ`. It asks for a human-readable `Dataset Briefing` artifact and a structured `Dataset Profile` artifact. The prompt is scoped to inventory, readiness, evidence, trust, caveats, and documentation, not analysis suggestions.

## Assertions Made

- The run starts on dataset `econ`.
- The run type is `describe`.
- Requested artifacts are `Dataset Briefing` and `Dataset Profile`.
- The config marks the run as a dataset-description task.
- The prompt includes the required briefing sections.
- The prompt requires `Readiness & Trust`, including whether the dataset is usable right now, what evidence supports that judgment, and what would make use unsafe or premature.
- The prompt excludes query instructions and suggested follow-ups.
- The response includes the briefing run id and terminal-session link.
