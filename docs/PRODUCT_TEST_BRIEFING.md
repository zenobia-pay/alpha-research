# Product Test Briefing

This briefing explains the user-facing product behavior covered by the test suite. When adding, removing, or renaming CLI product tests, golden fixtures, Symphony cases, or slow E2E scripts, update this file in the same change. `npm run docs:check` enforces that coverage mechanically.

## Deterministic CLI Product Tests

These tests exercise product behavior with controlled service responses. They assert what action the product takes, what the user sees, and which safety or evidence contracts are preserved.

### unauthenticated local run request bypasses remote planning

User asks to show active runs without a signed-in session. The product uses the local tracked-run store instead of trying to plan with remote tools. It asserts the first action is `list_tracked_runs` and the final response is an assistant message.

### async query run returns immediately with canonical dashboard and terminal links

User asks for viral tweets. The product starts a query run against `enriched-tweets`, returns immediately with the run id, dashboard URL, and terminal-session URL. It asserts the run prompt and config require mounted dataset grounding, fail loudly if mounted data cannot be read, and disallow public sample or GitHub CSV fallback data.

### dataset describe request starts briefing run with required artifacts

User asks to describe `econ`. The product starts a dataset briefing run, requests `Dataset Briefing` and `Dataset Profile` artifacts, and scopes the prompt to descriptive documentation only. It asserts mounted dataset grounding is required, the briefing sections are present, query instructions and suggested follow-ups are excluded, and the user gets the run id plus terminal-session link.

### run result retrieval includes original prompt and artifacts

User asks to show a previous run result. The product retrieves the run bundle, presents the original request, summarizes structured result counts, explains artifacts as saved outputs, and includes grounded follow-up suggestions. It asserts the response is not just raw JSON.

### busy dataset conflict returns blocking run guidance

User starts work on a dataset whose volume is already locked by an active run. The product reports the blocking run id and dashboard link instead of hiding the conflict or starting duplicate work. It asserts the busy-run guidance is visible to the user.

### wait for run completion can time out deterministically

User asks to wait for a run. The product polls run status and events, but if the wait budget expires while the run is still active, it reports that the run is still running. It asserts timeout handling is explicit and nonterminal.

### run debug bundle redacts session token and includes remote evidence

User or engineer asks for a run debug bundle. The product builds a redacted bundle with CLI version, session preview, dashboard URL, tracked-run cache, run payload, results, events, and artifacts. It asserts the full token is never present while diagnostic evidence is preserved.

### product planning: vague viral tweets request designs scoped experiment before running

User asks, "what's up with tweets? Can you run an experiment for me on what types of tweets go viral?" The product inspects `enriched-tweets` and returns a concrete experiment design instead of launching expensive work immediately. It asserts the plan defines viral tweets as the top `0.1%` by `quote_tweet_count`, samples `100` random viral tweets, specifies strict JSON labels including `hook_type` and `controversy_level`, asks for confirmation, and offers alternatives such as retweets/likes or a control group.

### product workflow success: econ research hypothesis creates data environment, specs, scripts, labels, and artifacts

User asks for an economics dataset for a housing-cycle hypothesis and wants results. The product lists existing datasets, creates a research environment with a complete acquisition plan, waits for the build, creates a structured research spec, runs transformation, labeling, and hypothesis analysis, waits at each stage, then retrieves final artifacts. It asserts the required source catalog, source URLs, row counts, missingness checks, join keys, labeling prompt, charts, tables, and markdown report are all represented.

## Golden Transcript Product Fixtures

Golden fixtures capture durable CLI conversations and the minimum user-facing summary each workflow must keep stable.

### golden: cancel active run

User asks to cancel `run-cancel-1`. The product calls `cancel_remote_run` and confirms cancellation. It asserts the summary includes `Cancelled remote run run-cancel-1`.

### golden: public data environment

User asks to create a public data environment from SEC filings for payment-company risk factors. The product lists datasets, starts a public-data environment build, and returns the run id plus dashboard link. It asserts the build is not treated as a finished result.

### golden: mixed public private environment

User asks to set up an economics research environment using FRED plus a private sales export. The product lists datasets, starts a mixed research-environment build, and returns the run id plus dashboard link. It asserts public/private acquisition is represented as environment creation, not a lightweight query.

### golden: retrieve run result

User asks to show `run-results-1`. The product retrieves the result, shows the original request, summarizes row counts, and explains artifacts as saved outputs. It asserts result retrieval remains readable and artifact-aware.

### golden: show remote datasets

User asks to show remote datasets. The product lists available datasets and reports the count. It asserts dataset discovery remains a simple direct action.

## Symphony Product Cases

Symphony cases are acceptance fixtures for product-level planning and orchestration behavior.

### symphony case: econ housing cycle dataset build

User asks for an economics dataset with all necessary data for a housing-cycle hypothesis. The product lists existing datasets, creates a research environment, and sends a concrete acquisition/validation plan. It asserts the environment prompt includes FRED, Census, Zillow, BLS, FHFA, NBER, row counts, missingness, join-key validation, source URLs, and a manifest.

### symphony case: viral tweets experiment planning

User asks for an experiment about viral tweets. The product finds `enriched-tweets` and proposes a scoped design before running work. It asserts the design includes top `0.1%`, `quote_tweet_count`, `100` random viral tweets, strict JSON labeling, visualizations, control-group alternatives, and a confirmation question. It also asserts no query, labeling, agent, or run-start tool is called.

## Registry And Harness Contract Tests

These tests keep product actions stable by validating the tool surface and links the assistant relies on.

### tool registry is structurally valid and serializable

The product tool registry is exported as stable metadata. The test asserts each tool has a name, description, JSON schema, and serializable shape so harnesses and model prompts can depend on it.

### tool registry metadata exposes async run-start tools

The product marks tools that start asynchronous work. The test asserts run-starting tools are discoverable so UI and harness code know when a response should include run tracking instead of immediate results.

### dashboard run links use canonical dashboard route

The product emits dashboard URLs for runs. The test asserts links use the canonical dashboard route and fragment format, keeping user navigation stable.

## Slow Product E2E Scripts

Slow tests exercise full product journeys. They are explicit opt-in because they provision work, wait for asynchronous runs, and inspect completed artifacts.

### test:slow

Runs the full slow product suite. It asserts both economics and tweets workflows can complete through their current staged journeys.

### test:slow:econ

Runs every economics slow stage in order: discovery, normalization planning, normalization execution, end-to-end environment orchestration, and hypothesis analysis. It asserts the economics product journey can move from source discovery through usable hypothesis artifacts.

### test:slow:econ:discover

Runs the Econ Discovery Agent journey. The product creates or reuses the canonical `econ` environment, inspects the required source catalog, classifies fetchability, records canonical URLs and direct download/API endpoints, and produces `source_registry.plan.json` plus a discovery report. It asserts discovery evidence includes fetchability, active/metadata-only/gated states, canonical URLs, direct downloads, and artifacts.

### test:slow:econ:normalization-plan

Runs the Econ Normalization Planning Agent journey. The product reads discovery outputs, does not execute ETL, and produces `normalization_plan.json` plus a human-readable plan. It asserts target tables, raw-to-normalized mappings, primary keys, join keys, QA checks, and excluded source reasons are present.

### test:slow:econ:normalization-execution

Runs the Econ Acquisition, Normalization Execution, and QA journey. The product fetches active/fetchable raw data, writes `raw_inventory.json`, executes normalization, and produces normalized tables, `source_registry.csv`, `table_catalog.json`, `manifest.json`, QA outputs, and optionally a DuckDB catalog. It asserts public/fetchable sources cannot succeed with placeholder metadata and must have row-count and validation evidence.

### test:slow:econ:environment

Runs the Econ Orchestrator end to end. The product executes discovery, acquisition, normalization planning, normalization execution, and QA in one environment build. It asserts the full source catalog, normalized outputs, manifest, table catalog, source registry, row counts, missingness, join keys, source URLs, and artifacts are present.

### test:slow:econ:hypothesis

Runs the economics hypothesis analysis journey. The product uses the existing canonical `econ` environment, inspects whether necessary data exists, creates the analysis subset, runs transformation and labeling as needed, selects visualization artifacts, tests the housing-cycle hypothesis, waits for completion, and shows results. It asserts labeling, chart, hypothesis, row-count, source, and artifact evidence.

### test:slow:tweets

Runs the viral tweets research journey. The product handles the user's viral-tweets request, applies test approval to proceed, uses `enriched-tweets`, reads the mounted dataset, defines viral as the top `0.1%` by `quote_tweet_count`, samples `100` random viral tweets, labels them with strict JSON fields, produces charts and representative examples, waits for completion, and retrieves artifacts. It asserts mounted dataset grounding is mandatory and runtime evidence contains no GitHub/raw CSV/sample fallback.
