# Product Test Briefing Index

Each product test has its own Markdown briefing under `docs/product-tests/`. Every briefing explains the test from a product standpoint:

- how the product is used
- what actions are taken
- what assertions are made

When a test contract changes, update the corresponding file in `docs/product-tests/`. When a per-test file is added, removed, or renamed, update this index in the same change. `npm run docs:check` enforces those rules.

For a readable HTML version, run `npm run docs:product-tests:site` and open `docs/product-tests-site/index.html`.

## Deterministic CLI Product Tests

- [unauthenticated local run request bypasses remote planning](product-tests/unauthenticated-local-run-request-bypasses-remote-planning.md)
- [product orientation presents command center identities without tools](product-tests/product-orientation-presents-command-center-identities-without-tools.md)
- [file import how-to asks for path before ingesting](product-tests/file-import-how-to-asks-for-path-before-ingesting.md)
- [vague housing risk request asks scope before costly work](product-tests/vague-housing-risk-request-asks-scope-before-costly-work.md)
- [async query run returns immediately with canonical dashboard and terminal links](product-tests/async-query-run-returns-immediately-with-canonical-dashboard-and-terminal-links.md)
- [dataset describe request starts briefing run with required artifacts](product-tests/dataset-describe-request-starts-briefing-run-with-required-artifacts.md)
- [run result retrieval includes original prompt and artifacts](product-tests/run-result-retrieval-includes-original-prompt-and-artifacts.md)
- [non-resumable run continuation returns artifacts instead of crashing](product-tests/non-resumable-run-continuation-returns-artifacts-instead-of-crashing.md)
- [busy dataset conflict returns blocking run guidance](product-tests/busy-dataset-conflict-returns-blocking-run-guidance.md)
- [wait for run completion can time out deterministically](product-tests/wait-for-run-completion-can-time-out-deterministically.md)
- [run debug bundle redacts session token and includes remote evidence](product-tests/run-debug-bundle-redacts-session-token-and-includes-remote-evidence.md)
- [run debug bundle classifies worker-unreachable state as lifecycle-uncertain](product-tests/run-debug-bundle-classifies-worker-unreachable-state-as-lifecycle-uncertain.md)
- [product planning: vague viral tweets request designs scoped experiment before running](product-tests/product-planning-vague-viral-tweets-request-designs-scoped-experiment-before-running.md)
- [product workflow success: econ research hypothesis creates data environment, specs, scripts, labels, and artifacts](product-tests/product-workflow-success-econ-research-hypothesis-creates-data-environment-specs-scripts-labels-and-artifacts.md)

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
