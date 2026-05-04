# Journey Repair Verdict Comparison

Generated: 2026-05-04 19:38:27Z.

Branch under test: `codex/journey-repair-sequential-20260502T021104Z` at `32a3b66`.

Baseline:
- J01-J16 and P01-P09 use the persisted May 1 report at `reports/journey-evals/20260501T200949Z`.
- P10-P13 were not present in that persisted report, so they were captured and judged at the repair parent `98bcb3d`.
- TUI01-TUI10 had no persisted May 1 judge briefings, so they were captured and judged at `98bcb3d`.

After:
- Prompt-mode J01-J16 and P01-P13 captured under `.tmp/journey-rerun-20260504T193827Z/prompt`.
- TUI01-TUI10 captured under `.tmp/journey-rerun-20260504T193827Z/tui`.

## Merge Safety

Not safe to merge yet.

The repaired branch removes all prompt-mode failures and improves six product journeys, but it still has:
- Prompt regressions: J06 `Pass -> Partial`, J16 `Pass -> Partial`.
- TUI regression: TUI04 `Partial -> Fail`.
- Remaining TUI failure: TUI09 stays `Fail`.

## Summary

| Suite | Before | After | Movement |
| --- | --- | --- | --- |
| J01-J16 | 5 Pass, 11 Partial, 0 Fail | 5 Pass, 11 Partial, 0 Fail | 2 improved, 2 regressed, 12 unchanged |
| P01-P13 | 1 Pass, 10 Partial, 2 Fail | 6 Pass, 7 Partial, 0 Fail | 6 improved, 0 regressed, 7 unchanged |
| TUI01-TUI10 | 0 Pass, 5 Partial, 5 Fail | 1 Pass, 7 Partial, 2 Fail | 5 improved, 1 regressed, 4 unchanged |

## J Journeys

| Journey | Before | After | Movement |
| --- | --- | --- | --- |
| J01 | Pass | Pass | Unchanged |
| J02 | Partial | Partial | Unchanged |
| J03 | Partial | Partial | Unchanged |
| J04 | Partial | Partial | Unchanged |
| J05 | Partial | Pass | Improved |
| J06 | Pass | Partial | Regressed |
| J07 | Partial | Partial | Unchanged |
| J08 | Pass | Pass | Unchanged |
| J09 | Partial | Partial | Unchanged |
| J10 | Pass | Pass | Unchanged |
| J11 | Partial | Partial | Unchanged |
| J12 | Partial | Pass | Improved |
| J13 | Partial | Partial | Unchanged |
| J14 | Partial | Partial | Unchanged |
| J15 | Partial | Partial | Unchanged |
| J16 | Pass | Partial | Regressed |

## P Journeys

| Journey | Before | After | Movement |
| --- | --- | --- | --- |
| P01 | Partial | Pass | Improved |
| P02 | Partial | Pass | Improved |
| P03 | Partial | Partial | Unchanged |
| P04 | Partial | Partial | Unchanged |
| P05 | Partial | Pass | Improved |
| P06 | Pass | Pass | Unchanged |
| P07 | Partial | Partial | Unchanged |
| P08 | Partial | Partial | Unchanged |
| P09 | Partial | Partial | Unchanged |
| P10 | Fail | Pass | Improved |
| P11 | Partial | Partial | Unchanged |
| P12 | Partial | Pass | Improved |
| P13 | Fail | Partial | Improved |

## TUI Journeys

| Journey | Before | After | Movement |
| --- | --- | --- | --- |
| TUI01 | Partial | Partial | Unchanged |
| TUI02 | Partial | Partial | Unchanged |
| TUI03 | Partial | Pass | Improved |
| TUI04 | Partial | Fail | Regressed |
| TUI05 | Fail | Partial | Improved |
| TUI06 | Fail | Partial | Improved |
| TUI07 | Fail | Partial | Improved |
| TUI08 | Fail | Partial | Improved |
| TUI09 | Fail | Fail | Unchanged |
| TUI10 | Partial | Partial | Unchanged |

## Commands Run

```bash
npm install
find . -name '*.tsbuildinfo' -delete
npx tsc -b
npm run build
JOURNEY_SNAPSHOT_MS=5000 JOURNEY_TIMEOUT_MS=180000 npm exec tsx scripts/run-journey-evals.ts -- --suite=all --out=.tmp/journey-rerun-20260504T193827Z/prompt --no-judge
TUI_JOURNEY_TIMEOUT_SECONDS=180 TUI_JOURNEY_AFTER_MESSAGE_SECONDS=18 python3 scripts/run-tui-journey-evals.py --out .tmp/journey-rerun-20260504T193827Z/tui --no-judge
JOURNEY_JUDGE_TIMEOUT_MS=360000 npm exec tsx scripts/run-journey-evals.ts -- --journeys=<id> --out=.tmp/journey-rerun-20260504T193827Z/prompt --judge-only
TUI_JOURNEY_JUDGE_TIMEOUT_SECONDS=360 python3 scripts/run-tui-journey-evals.py --journeys <id> --out .tmp/journey-rerun-20260504T193827Z/tui --judge-only
```

