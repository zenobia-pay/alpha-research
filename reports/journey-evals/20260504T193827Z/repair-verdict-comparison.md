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

Safe to merge after the 2026-05-04 22:37:56Z focused merge-fix rerun.

The first repaired-branch rerun removed all prompt-mode failures but still had merge blockers in J06, J16, TUI04, and TUI09. The focused merge-fix pass reran those four journeys after the follow-up fixes:
- J06: `Pass`
- J16: `Pass`
- TUI04: `Partial`
- TUI09: `Partial`

There are still residual UX issues in the TUI suite, but the hard failures and regressions that blocked merge safety are cleared.

## Summary

| Suite | Before | After | Movement |
| --- | --- | --- | --- |
| J01-J16 | 5 Pass, 11 Partial, 0 Fail | 7 Pass, 9 Partial, 0 Fail | 4 improved, 0 regressed, 12 unchanged |
| P01-P13 | 1 Pass, 10 Partial, 2 Fail | 6 Pass, 7 Partial, 0 Fail | 6 improved, 0 regressed, 7 unchanged |
| TUI01-TUI10 | 0 Pass, 5 Partial, 5 Fail | 1 Pass, 9 Partial, 0 Fail | 6 improved, 0 regressed, 4 unchanged |

## J Journeys

| Journey | Before | After | Movement |
| --- | --- | --- | --- |
| J01 | Pass | Pass | Unchanged |
| J02 | Partial | Partial | Unchanged |
| J03 | Partial | Partial | Unchanged |
| J04 | Partial | Partial | Unchanged |
| J05 | Partial | Pass | Improved |
| J06 | Pass | Pass | Unchanged |
| J07 | Partial | Partial | Unchanged |
| J08 | Pass | Pass | Unchanged |
| J09 | Partial | Partial | Unchanged |
| J10 | Pass | Pass | Unchanged |
| J11 | Partial | Partial | Unchanged |
| J12 | Partial | Pass | Improved |
| J13 | Partial | Partial | Unchanged |
| J14 | Partial | Partial | Unchanged |
| J15 | Partial | Partial | Unchanged |
| J16 | Pass | Pass | Unchanged |

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
| TUI04 | Partial | Partial | Unchanged |
| TUI05 | Fail | Partial | Improved |
| TUI06 | Fail | Partial | Improved |
| TUI07 | Fail | Partial | Improved |
| TUI08 | Fail | Partial | Improved |
| TUI09 | Fail | Partial | Improved |
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
JOURNEY_SNAPSHOT_MS=5000 JOURNEY_TIMEOUT_MS=180000 npm exec tsx scripts/run-journey-evals.ts -- --journeys=J06,J16 --out=.tmp/journey-mergefix-20260504T223756Z/prompt --no-judge
TUI_JOURNEY_TIMEOUT_SECONDS=180 TUI_JOURNEY_AFTER_MESSAGE_SECONDS=18 python3 scripts/run-tui-journey-evals.py --journeys TUI04,TUI09 --out .tmp/journey-mergefix-20260504T223756Z/tui --no-judge
JOURNEY_JUDGE_TIMEOUT_MS=360000 npm exec tsx scripts/run-journey-evals.ts -- --journeys=J16 --out=.tmp/journey-mergefix-20260504T223756Z/prompt2 --judge-only
```
