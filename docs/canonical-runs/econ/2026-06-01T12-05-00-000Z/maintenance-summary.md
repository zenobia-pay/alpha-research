# ALFRED Vintage Macro Ingestion Summary

- Execution id: `87497477-c059-4754-9374-6dc49c233b95`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/87497477-c059-4754-9374-6dc49c233b95`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/87497477-c059-4754-9374-6dc49c233b95/artifacts`
- Final execution status: `failed`
- Validation status: `blocked`

## What Landed

The worker passed the dataset write probe, found sufficient inode/disk headroom, and wrote compact ALFRED files under `raw/alfred/`:

| File | Rows | Coverage | Bytes | SHA-256 |
|---|---:|---|---:|---|
| `raw/alfred/GDP_alfred.csv` | 317 | 1947-01-01 to 2026-01-01 | 6,386 | `554eb5f7ddf57d91d1464182e440e6327a3f9d8c0737e063a11ebe7235b1586b` |
| `raw/alfred/UNRATE_alfred.csv` | 940 | 1948-01-01 to 2026-04-01 | 14,145 | `7e48b3ad90e30b73b5a62ad9a85cb96f5aea60410ac153384423c02186ac27d5` |
| `raw/alfred/CPIAUCSL_alfred.csv` | 952 | 1947-01-01 to 2026-04-01 | 17,677 | `a552f64ca856e33448b342fe0b792d6816793fb84a6de87b4f2b6bec590fe1bd` |
| `raw/alfred/PAYEMS_alfred.csv` | 1,048 | 1939-01-01 to 2026-04-01 | 18,324 | `e9d14cf5b08cd012dc84d8795d1583a95c9df328df8ab07bb4da8267c3a82428` |
| `raw/alfred/FEDFUNDS_alfred.csv` | 862 | 1954-07-01 to 2026-04-01 | 13,888 | `fe7dabe10c7f8aaa26f944e073747c736e1b65b7501cff3363a69bf3362a94e7` |
| `raw/alfred/DGS10_alfred.csv` | 16,803 | 1962-01-02 to 2026-05-28 | 267,500 | `819f9298c2b78edb7af83c7adf464916a1ff9a89115992b3dd5d4329b1794c1c` |

Each CSV has `observation_date` plus one vintage-dated value column such as `GDP_20260601`. This is useful real-time snapshot coverage but not a full historical revision matrix.

## Why Validation Blocked

`npm run canonical:dataset -- validate --dataset-id econ --execution-id 87497477-c059-4754-9374-6dc49c233b95` blocked because:

- the remote execution ended with status `failed`;
- primary artifacts `dataset_briefing.md`, `improvement_result.json`, `work.md`, and `report.html` were not promoted to the expected artifact paths;
- backend profile readback still points to prior run `4822354c-5587-421f-b0e6-b8616d6c6e99`, not this execution.

Local public docs were updated from the artifact stream to record the files that landed, but the canonical backend profile was not treated as validated.

## Follow-Up

Run a narrower profile-sync/artifact-promotion repair, or rerun ALFRED ingestion with explicit copy commands for the four primary artifacts into `/results/<execution-id>/` before final status handling. A later job should add multiple historical ALFRED vintage dates if the objective is a true revision-history dataset rather than one latest-vintage snapshot.
