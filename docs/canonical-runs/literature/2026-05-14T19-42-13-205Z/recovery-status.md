# Literature Bootstrap Recovery Status

Date: 2026-05-14

## Prior Run Readback

- `695eb3d2-2e21-4de2-bc19-527cab901c47`: `failed`; zero artifacts; terminal event was `Remote agent run failed: codex exec failed with exit code 1`.
- `aadceca1-f7e9-47aa-8c58-f21c8ea51d4b`: `failed`; five remote-agent diagnostic artifacts; terminal event was `Remote agent run completed without required primary artifact: dataset_briefing.md`.
- `11fae774-791a-4cde-b7e3-aaa7d0d0c537`: confirmed stuck in `running` with repeated `Starting remote agent TUI` heartbeats and zero artifacts. Cancelled through the backend run cancellation path; readback showed `cancelled` at `2026-05-14T19:40:48.861Z`.

## Endpoint And Bootstrap Attempt

- Live `POST /api/admin/remote-agent-executions` returned `405` from `https://alpharesearch.nyc`, so the Remote Agent Execution endpoint was not proven available in production.
- `POST /api/admin/canonical-datasets/bootstrap` was present and accepted exactly one literature bootstrap request: `28a8abff-5eec-4120-849c-0e22a440585d`, Modal call `fc-01KRM05V0H6MM6BBD7CJ2515M1`.
- The bootstrap repeated `Starting remote agent TUI` through 410 seconds with zero artifacts and no progress to command execution. It was cancelled through the backend run cancellation path to avoid leaving the `literature` dataset locked.

## Acceptance State

- `literature` is present in the canonical catalog with Project Gutenberg, Internet Archive, HathiTrust metadata, Open Library, Wikisource, and Perseus seed sources.
- Required bootstrap artifacts are not complete because the production remote-agent execution path did not progress beyond TUI startup.
- Slack download alerts, `dataset_briefing.md`, source inventory, docs/profile readback, and proof of no user-facing run record remain blocked on the production admin remote-agent execution path.

## Retry Result

Retried after `POST /api/admin/remote-agent-executions` became available.

- Endpoint proof execution: `91393647-3050-4259-b1ae-29418161b461`; it reached the remote agent executor and produced command artifacts.
- Literature admin bootstrap execution: `a581c7a0-4bf8-4b18-9121-a5a59f444457`; terminal status `ready`; Modal call `fc-01KRM0WQJP14C247ZFTBCT7S72`.
- The bootstrap produced 27 deliverable artifacts, including `dataset_briefing.md`, `source_registry.csv`, `source_inventory.json`, `manifest.json`, `download_inventory.*`, `download_events.jsonl`, `raw_inventory.*`, `volume_inventory.*`, `volume_tree.txt`, `data_dictionary.md`, `quality_report.md`, `slack_download_alerts.jsonl`, `slack_briefing.md`, `docs/public-datasets/briefings/literature.md`, `docs/public-datasets/literature.mdx`, and `improvement_result.json`.
- CLI dataset readback shows `literature` as a ready dataset.
- User-facing run readback for `datasetId=literature` returned zero runs, and the admin execution id was not present in user run records.
- The dataset profile was updated from the produced `dataset_briefing.md`; readback confirmed `briefingMarkdown` contains `# Literal Data Inventory` and `describedRunId` is `a581c7a0-4bf8-4b18-9121-a5a59f444457`.
- Slack acceptance is covered by `slack_download_alerts.jsonl` and `slack_briefing.md`; the run result records an explicit blocker rather than confirmed delivery.

Remaining caveat: `improvement_result.json` reports `status: blocked_read_only_volume` and `diskInventoryProven: false` because `/data/datasets/literature` was mounted read-only. The run regenerated inventories and docs in the writable workspace/results area, but could not write them back into the canonical dataset mount.
