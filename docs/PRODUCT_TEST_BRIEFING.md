# Product Test Briefing Index

Each product test has its own Markdown briefing under `docs/product-tests/`. Every briefing explains the test from a product standpoint:

- how the product is used
- what actions are taken
- what assertions are made

When a test contract changes, update the corresponding file in `docs/product-tests/`. When a per-test file is added, removed, or renamed, update this index in the same change. `npm run docs:check` enforces those rules.

For a readable HTML version, run `npm run docs:product-tests:site` and open `docs/product-tests-site/index.html`.

## Deterministic CLI Product Tests

- [unauthenticated local run request bypasses remote planning](product-tests/unauthenticated-local-run-request-bypasses-remote-planning.md)
- [signed-out remote dataset request explains auth recovery and preserves intent](product-tests/signed-out-remote-dataset-request-explains-auth-recovery-and-preserves-intent.md)
- [signed-out composer placeholder is contextual](product-tests/signed-out-composer-placeholder-is-contextual.md)
- [product orientation presents command center identities without tools](product-tests/product-orientation-presents-command-center-identities-without-tools.md)
- [signed-out cold-start orientation shows login hint](product-tests/signed-out-cold-start-orientation-shows-login-hint.md)
- [file import how-to asks for path before ingesting](product-tests/file-import-how-to-asks-for-path-before-ingesting.md)
- [journey P02 wording resolves locally without remote planning](product-tests/journey-p02-wording-resolves-locally-without-remote-planning.md)
- [vague housing risk request asks scope before costly work](product-tests/vague-housing-risk-request-asks-scope-before-costly-work.md)
- [dataset inventory is recommendation-first, name-first, and de-emphasizes noisy datasets](product-tests/dataset-inventory-is-recommendation-first-name-first-and-de-emphasizes-noisy-datasets.md)
- [dataset selection from topic uses dataset metadata and asks one focused follow-up](product-tests/dataset-selection-from-topic-uses-dataset-metadata-and-asks-one-focused-follow-up.md)
- [remote planning emits immediate progress before waiting on backend response](product-tests/remote-planning-emits-immediate-progress-before-waiting-on-backend-response.md)
- [dataset recommendation inventory includes ranked shortlist for the topic](product-tests/dataset-recommendation-inventory-includes-ranked-shortlist-for-the-topic.md)
- [async query run returns immediately with canonical dashboard and terminal links](product-tests/async-query-run-returns-immediately-with-canonical-dashboard-and-terminal-links.md)
- [dataset describe request reads briefing markdown without starting a run](product-tests/dataset-describe-request-reads-briefing-markdown-without-starting-a-run.md)
- [whats-in dataset question reads briefing markdown without starting a run](product-tests/whats-in-dataset-question-reads-briefing-markdown-without-starting-a-run.md)
- [specific viral tweets experiment starts with user-facing analysis summary and artifact expectations](product-tests/specific-viral-tweets-experiment-starts-with-user-facing-analysis-summary-and-artifact-expectations.md)
- [dataset inspection surfaces schema evidence for requested analysis fields](product-tests/dataset-inspection-surfaces-schema-evidence-for-requested-analysis-fields.md)
- [busy dataset conflict explains active run and emits heartbeat while waiting](product-tests/busy-dataset-conflict-explains-active-run-and-emits-heartbeat-while-waiting.md)
- [dataset describe tool reads saved briefing without starting a run](product-tests/dataset-describe-tool-reads-saved-briefing-without-starting-a-run.md)
- [run result retrieval includes selected run context and artifacts](product-tests/run-result-retrieval-includes-selected-run-context-and-artifacts.md)
- [last run results select the latest completed run and explain newer active runs](product-tests/last-run-results-select-the-latest-completed-run-and-explain-newer-active-runs.md)
- [last run results report an in-progress latest run when nothing has completed](product-tests/last-run-results-report-an-in-progress-latest-run-when-nothing-has-completed.md)
- [last run results report a failed latest run when nothing completed successfully](product-tests/last-run-results-report-a-failed-latest-run-when-nothing-completed-successfully.md)
- [continuity question returns compact lifecycle summary without tool chatter](product-tests/continuity-question-returns-compact-lifecycle-summary-without-tool-chatter.md)
- [non-resumable run continuation returns artifacts instead of crashing](product-tests/non-resumable-run-continuation-returns-artifacts-instead-of-crashing.md)
- [busy dataset conflict returns blocking run guidance](product-tests/busy-dataset-conflict-returns-blocking-run-guidance.md)
- [dataset describe reads saved briefing without starting duplicate run](product-tests/dataset-describe-reads-saved-briefing-without-starting-duplicate-run.md)
- [prompt-mode busy dataset shortcut shows age, health, and clear actions](product-tests/prompt-mode-busy-dataset-shortcut-shows-age-health-and-clear-actions.md)
- [wait for run completion can time out deterministically](product-tests/wait-for-run-completion-can-time-out-deterministically.md)
- [run debug bundle redacts session token and includes remote evidence](product-tests/run-debug-bundle-redacts-session-token-and-includes-remote-evidence.md)
- [run debug bundle classifies worker-unreachable state as lifecycle-uncertain](product-tests/run-debug-bundle-classifies-worker-unreachable-state-as-lifecycle-uncertain.md)
- [stuck run question explains fresh booting run in plain language](product-tests/stuck-run-question-explains-fresh-booting-run-in-plain-language.md)
- [stuck run question escalates stale running run to debug now](product-tests/stuck-run-question-escalates-stale-running-run-to-debug-now.md)
- [canonical public environments use small versioned object-store resource profile](product-tests/canonical-public-environments-use-small-versioned-object-store-resource-profile.md)
- [environment builds support explicit large-ingest resource profile](product-tests/environment-builds-support-explicit-large-ingest-resource-profile.md)
- [product planning: vague viral tweets request designs scoped experiment before running](product-tests/product-planning-vague-viral-tweets-request-designs-scoped-experiment-before-running.md)
- [agent prompt frames RESEARCH as run-oriented command center](product-tests/agent-prompt-frames-research-as-run-oriented-command-center.md)
- [vague dataset interesting request gives a concise briefing and focused choice without starting a run](product-tests/vague-dataset-interesting-request-gives-a-concise-briefing-and-focused-choice-without-starting-a-run.md)
- [product workflow success: econ research hypothesis creates data environment, specs, scripts, labels, and artifacts](product-tests/product-workflow-success-econ-research-hypothesis-creates-data-environment-specs-scripts-labels-and-artifacts.md)
- [uploaded dataset deployment flow uses user-facing stage updates and upload progress](product-tests/uploaded-dataset-deployment-flow-uses-user-facing-stage-updates-and-upload-progress.md)

- [signed-out remote dataset request explains auth recovery and preserves intent](product-tests/signed-out-remote-dataset-request-explains-auth-recovery-and-preserves-intent.md)
- [signed-out composer placeholder is contextual](product-tests/signed-out-composer-placeholder-is-contextual.md)
- [signed-out cold-start orientation shows login hint](product-tests/signed-out-cold-start-orientation-shows-login-hint.md)
- [journey P02 wording resolves locally without remote planning](product-tests/journey-p02-wording-resolves-locally-without-remote-planning.md)
- [dataset inventory is recommendation-first, name-first, and de-emphasizes noisy datasets](product-tests/dataset-inventory-is-recommendation-first-name-first-and-de-emphasizes-noisy-datasets.md)
- [dataset selection from topic uses dataset metadata and asks one focused follow-up](product-tests/dataset-selection-from-topic-uses-dataset-metadata-and-asks-one-focused-follow-up.md)
- [remote planning emits immediate progress before waiting on backend response](product-tests/remote-planning-emits-immediate-progress-before-waiting-on-backend-response.md)
- [dataset recommendation inventory includes ranked shortlist for the topic](product-tests/dataset-recommendation-inventory-includes-ranked-shortlist-for-the-topic.md)
- [specific viral tweets experiment starts with user-facing analysis summary and artifact expectations](product-tests/specific-viral-tweets-experiment-starts-with-user-facing-analysis-summary-and-artifact-expectations.md)
- [dataset inspection surfaces schema evidence for requested analysis fields](product-tests/dataset-inspection-surfaces-schema-evidence-for-requested-analysis-fields.md)
- [busy dataset conflict explains active run and emits heartbeat while waiting](product-tests/busy-dataset-conflict-explains-active-run-and-emits-heartbeat-while-waiting.md)
- [dataset describe tool reads saved briefing without starting a run](product-tests/dataset-describe-tool-reads-saved-briefing-without-starting-a-run.md)
- [run result retrieval includes selected run context and artifacts](product-tests/run-result-retrieval-includes-selected-run-context-and-artifacts.md)
- [last run results select the latest completed run and explain newer active runs](product-tests/last-run-results-select-the-latest-completed-run-and-explain-newer-active-runs.md)
- [last run results report an in-progress latest run when nothing has completed](product-tests/last-run-results-report-an-in-progress-latest-run-when-nothing-has-completed.md)
- [last run results report a failed latest run when nothing completed successfully](product-tests/last-run-results-report-a-failed-latest-run-when-nothing-completed-successfully.md)
- [continuity question returns compact lifecycle summary without tool chatter](product-tests/continuity-question-returns-compact-lifecycle-summary-without-tool-chatter.md)
- [dataset describe reads saved briefing without starting duplicate run](product-tests/dataset-describe-reads-saved-briefing-without-starting-duplicate-run.md)
- [prompt-mode busy dataset shortcut shows age, health, and clear actions](product-tests/prompt-mode-busy-dataset-shortcut-shows-age-health-and-clear-actions.md)
- [stuck run question explains fresh booting run in plain language](product-tests/stuck-run-question-explains-fresh-booting-run-in-plain-language.md)
- [stuck run question escalates stale running run to debug now](product-tests/stuck-run-question-escalates-stale-running-run-to-debug-now.md)
- [vague dataset interesting request gives a concise briefing and focused choice without starting a run](product-tests/vague-dataset-interesting-request-gives-a-concise-briefing-and-focused-choice-without-starting-a-run.md)
- [uploaded dataset deployment flow uses user-facing stage updates and upload progress](product-tests/uploaded-dataset-deployment-flow-uses-user-facing-stage-updates-and-upload-progress.md)

## Golden Transcript Product Fixtures

- [golden: cancel active run](product-tests/golden-cancel-active-run.md)
- [golden: public data environment](product-tests/golden-public-data-environment.md)
- [golden: mixed public private environment](product-tests/golden-mixed-public-private-environment.md)
- [golden: retrieve run result](product-tests/golden-retrieve-run-result.md)
- [golden: show remote datasets](product-tests/golden-show-remote-datasets.md)

## Symphony Product Cases

- [symphony case: econ housing cycle dataset build](product-tests/symphony-case-econ-housing-cycle-dataset-build.md)
- [symphony case: viral tweets experiment planning](product-tests/symphony-case-viral-tweets-experiment-planning.md)

## Registry And Harness Contract Tests

- [tool registry is structurally valid and serializable](product-tests/tool-registry-is-structurally-valid-and-serializable.md)
- [tool registry metadata exposes async run-start tools](product-tests/tool-registry-metadata-exposes-async-run-start-tools.md)
- [dashboard run links use canonical dashboard route](product-tests/dashboard-run-links-use-canonical-dashboard-route.md)

## Slow Product E2E Scripts

- [test:slow](product-tests/test-slow.md)
- [test:slow:econ](product-tests/test-slow-econ.md)
- [test:slow:econ:discover](product-tests/test-slow-econ-discover.md)
- [test:slow:econ:normalization-plan](product-tests/test-slow-econ-normalization-plan.md)
- [test:slow:econ:normalization-execution](product-tests/test-slow-econ-normalization-execution.md)
- [test:slow:econ:environment](product-tests/test-slow-econ-environment.md)
- [test:slow:econ:hypothesis](product-tests/test-slow-econ-hypothesis.md)
- [test:slow:tweets](product-tests/test-slow-tweets.md)

- [blocked-or-failed recovery prompt stays focused on the current run and next action](product-tests/blocked-or-failed-recovery-prompt-stays-focused-on-the-current-run-and-next-action.md)
- [broad business-opportunity prompts stop at a scoped approval gate before any inventory or run work](product-tests/broad-business-opportunity-prompts-stop-at-a-scoped-approval-gate-before-any-inventory-or-run-work.md)
- [county-month housing-cycle dataset requests reuse a strong economics base and start the build immediately](product-tests/county-month-housing-cycle-dataset-requests-reuse-a-strong-economics-base-and-start-the-build-immediately.md)
- [dataset follow-up keeps the exact prior inventory match instead of fuzzy-overlap switching](product-tests/dataset-follow-up-keeps-the-exact-prior-inventory-match-instead-of-fuzzy-overlap-switching.md)
- [local dataset deletion confirms and then removes the selected instance](product-tests/local-dataset-deletion-confirms-and-then-removes-the-selected-instance.md)
- [dataset-owned canonical briefing describes available data without processed-table wording](product-tests/dataset-owned-canonical-briefing-describes-available-data-without-processed-table-wording.md)
- [dataset trust briefing reuses dataset-owned briefing before starting a new run](product-tests/dataset-trust-briefing-reuses-dataset-owned-briefing-before-starting-a-new-run.md)
- [field-definition questions use verified dataset metadata when available](product-tests/field-definition-questions-use-verified-dataset-metadata-when-available.md)
- [file-to-dataset onboarding asks only for path and description](product-tests/file-to-dataset-onboarding-asks-only-for-path-and-description.md)
- [last completed run decision summary explains changes, artifacts, trust, and next decisions](product-tests/last-completed-run-decision-summary-explains-changes-artifacts-trust-and-next-decisions.md)
- [mixed-source intake asks for all sources and approval before any build](product-tests/mixed-source-intake-asks-for-all-sources-and-approval-before-any-build.md)
- [prompt mode exits cleanly after local orientation response](product-tests/prompt-mode-exits-cleanly-after-local-orientation-response.md)
- [prompt mode exits cleanly after stuck-run local diagnosis](product-tests/prompt-mode-exits-cleanly-after-stuck-run-local-diagnosis.md)
- [prompt-mode busy dataset shortcut uses backend active runs before planning](product-tests/prompt-mode-busy-dataset-shortcut-uses-backend-active-runs-before-planning.md)
- [remote transport failures surface a concise blocked summary](product-tests/remote-transport-failures-surface-a-concise-blocked-summary.md)
- [specific viral tweets experiment blocks clearly when the named dataset is not ready](product-tests/specific-viral-tweets-experiment-blocks-clearly-when-the-named-dataset-is-not-ready.md)
- [viral tweets proposal follow-up starts when the suggested dataset and scope are confirmed](product-tests/viral-tweets-proposal-follow-up-starts-when-the-suggested-dataset-and-scope-are-confirmed.md)
