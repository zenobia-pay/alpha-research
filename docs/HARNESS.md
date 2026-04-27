# Harness Engineering For RESEARCH CLI

The RESEARCH CLI harness makes agent behavior inspectable, deterministic, and safe to evolve. It follows the core harness-engineering principle that useful agent work depends on the surrounding tools, tests, docs, and observability, not just the model prompt.

## Local Harness Commands

```bash
npm run agent:check
npm run harness:check
npm run test:cli
npm run test:golden
npm run build
npm run typecheck
npm run docs:check
npm run architecture:check
npm run smoke:local
npm run test:slow
npm run test:slow:econ
npm run test:slow:tweets
npm run deploy:check
```

`harness:check` validates:

- required agent-facing docs exist
- tool registry names, descriptions, schemas, and JSON serialization
- canonical dashboard run URL generation
- no normal CLI harness path requires a local `OPENAI_API_KEY`

`agent:check` is the canonical full local gate. It runs build, typecheck, tests, harness validation, docs consistency, architecture boundaries, local API smoke, and deployment readiness checks.

`docs:check` validates that agent-facing docs are present, linked paths exist, documented npm scripts exist, and run lifecycle statuses stay aligned with `apps/cli/src/runs.ts`.

`architecture:check` enforces workspace dependency boundaries and keeps `apps/cli/src/tool-registry.ts` metadata-only.

`smoke:local` starts the local API against fixture instances and verifies health, instance listing, and bootstrap payloads.

`deploy:check` validates DigitalOcean service files and confirms built API/frontend artifacts exist after `npm run build`.

`test:slow` runs the live product E2E suite. It currently includes `test:slow:econ` and `test:slow:tweets`. These tests call the real Alpha Research backend, can provision cloud resources, and can run for a long time while async jobs complete. They require either an existing `research login` session or `RESEARCH_E2E_TOKEN`.

## Deterministic Test Rules

CLI harness tests must not call the real Alpha Research API, OpenAI, DigitalOcean, or the user's real session directory.

Use:

```bash
RESEARCH_SESSION_DIR=.tmp/research-test RESEARCH_DISABLE_RUN_WATCHER=1 npm run test:cli
```

The tests inject `AgentRuntimeDeps` into `runAgentTurn`, replacing the remote client and session reader with fakes. This keeps the model/tool loop testable without network access.

## Golden Transcripts

Golden fixtures live under `apps/cli/test/golden`.

Each fixture defines:

- prompt
- fake backend `/api/cli/respond` payload
- fake remote data/run payloads
- expected tool-call sequence
- expected user-facing summary fragments

Golden tests should cover durable user workflows:

- list remote datasets
- create a local-file dataset
- create a mixed public/private research environment
- retrieve the result of the last run
- cancel an active run
- handle auth refresh or backend active-run conflicts
- handle failed run results with diagnostic guidance
- handle wait-for-run-completion timeout
- create public-data environments

## Product Workflow Success Case

`apps/cli/test/agent-harness.test.ts` includes a product-level success contract for an econ research hypothesis workflow:

```text
Make me an econ dataset with all necessary econ datasets for a housing-cycle hypothesis,
then wait until complete and show me the results and artifacts.
```

The success case proves the CLI can orchestrate the full promised workflow against hermetic remote fakes:

1. inspect existing remote datasets
2. create a research environment with a concrete acquisition plan
3. require source coverage for the full econ and housing source catalog
4. require normalization, source URLs, row counts, missingness, join-key, and coverage validation
5. wait for the environment build run to complete
6. create a structured research spec with subset, shaping, labeling, and artifact requirements
7. run the transformation script for a county-month analysis panel
8. run the labeling job with an explicit market-regime labeling prompt
9. run the hypothesis analysis with requested table, chart, and markdown artifacts
10. wait for the analysis run and retrieve final artifacts

This hermetic product workflow test validates the CLI orchestration contract and the shape of the plan/results without calling live public data APIs, Alpha Research production, OpenAI, or DigitalOcean.

The same harness also includes a planning-quality contract for vague experiment requests:

```text
what's up with tweets? Can you run an experiment for me on what types of tweets go viral?
```

The success case requires the agent to inspect `enriched-tweets`, avoid launching a run, and respond with a concrete experiment design for confirmation. The design must define virality as the top 0.1% by quote tweets, sample 100 random viral tweets, specify an LLM labeling schema and strict JSON labeling prompt, specify visualizations and synthesis, and ask whether to proceed or use alternatives such as retweets/likes or a control group.

## Slow Product E2E

The slow product E2E is intentionally not part of `agent:check`. It is the test to run when validating whether the actual product works end to end, not just whether the local harness and control-plane contracts are healthy.

Run the full slow suite with:

```bash
npm run build
npm run test:slow
```

Run individual cases with:

```bash
npm run test:slow:econ
npm run test:slow:tweets
```

The econ live E2E uses the built CLI against the real backend, waits for the long-running async workflow, extracts run ids from the real CLI output, fetches `/api/cli/runs/:runId/results`, and fails unless the evidence contains successful terminal runs, produced artifacts, every required source name and URL, and proof terms for manifest, row counts, missingness, join keys, source URLs, labeling, charts, and artifacts.

The required source catalog is:

- Federal Reserve / FRED: https://fred.stlouisfed.org/
- U.S. Census Bureau: https://www.census.gov/data.html
- Zillow: https://www.zillow.com/research/data/
- National Association of Realtors: https://www.nar.realtor/research-and-statistics
- Fannie Mae: https://www.fanniemae.com/research-and-insights/surveys
- BLS: https://www.bls.gov/data/
- Consumer Price Index: https://www.bls.gov/cpi/
- Case-Shiller Index: https://www.spglobal.com/spdji/en/index-family/corelogic-sp-case-shiller/
- NBER: https://www.nber.org/
- Freddie Mac: https://mf.freddiemac.com/aimi
- Redfin: https://www.redfin.com/news/data-center/
- IMF: https://www.imf.org/en/Data
- Federal Reserve Bank of New York: https://www.newyorkfed.org/data-and-statistics
- Apartment List: https://www.apartmentlist.com/research/category/data-rent-estimates
- Pew Research Center: https://www.pewresearch.org/
- American Community Survey: https://www.census.gov/programs-surveys/acs/data.html
- CoreLogic: https://www.corelogic.com/intelligence/us-home-price-insights/
- FHFA Home Price Index: https://www.fhfa.gov/data/hpi
- American Time Use Survey: https://www.bls.gov/tus/
- Current Population Survey: https://www.census.gov/programs-surveys/cps.html
- Senior Loan Officer Opinion Survey: https://www.federalreserve.gov/data/sloos.htm
- ONS: https://www.ons.gov.uk/
- Personal Consumption Expenditures: https://www.bea.gov/data/consumer-spending/main
- American Housing Survey: https://www.census.gov/programs-surveys/ahs.html
- BEA: https://www.bea.gov/data
- Consumer Expenditure Survey: https://www.bls.gov/cex/
- General Social Survey: https://gss.norc.org/
- Panel Study of Income Dynamics: https://psidonline.isr.umich.edu/
- Zillow Home Value Index: https://www.zillow.com/research/data/
- Architecture Billings Index: https://www.aia.org/aia-architecture-billings-index
- Consumer Credit Panel: https://www.newyorkfed.org/data-and-statistics/data-visualization/household-credit-and-debt
- Current Employment Statistics: https://www.bls.gov/ces/
- Gallup: https://news.gallup.com/
- IRS Statistics: https://www.irs.gov/statistics
- Job Openings and Labor Turnover Survey: https://www.bls.gov/jlt/
- Local Area Unemployment Statistics: https://www.bls.gov/lau/
- OECD: https://www.oecd.org/en/data/indicators/housing-prices.html
- Our World in Data: https://ourworldindata.org/
- Pulsenomics Home Price Expectations Survey: https://pulsenomics.com/surveys/
- Wells Fargo / NAHB Housing Market Index: https://www.nahb.org/news-and-economics/housing-economics/indices/housing-market-index
- World Happiness Report: https://worldhappiness.report/data/
- Zillow Observed Rent Index: https://www.zillow.com/research/data/

The default timeout is 90 minutes. Override it when needed:

```bash
RESEARCH_PRODUCT_E2E_TIMEOUT_MS=7200000 npm run test:slow:econ
```

The tweets live E2E uses this prompt:

```text
what's up with tweets? Can you run an experiment for me on what types of tweets go viral?
```

Because slow tests are non-interactive, the prompt also includes explicit test approval to run the planned design. The test fails unless the real workflow uses `enriched-tweets`, defines viral as the top 0.1% by `quote_tweet_count`, samples 100 random viral tweets, runs labeling with strict JSON fields, produces visualizations, reaches terminal success, and exposes artifacts in run results.

## Runtime Seams

`AgentRuntimeDeps` is the main harness seam:

- `createRemoteClient`: inject fake backend behavior.
- `readSession`: isolate session state.
- `login`: test auth-expiry behavior without opening a browser.
- `createToolRegistry`: constrain tools for targeted tests.

Do not add broad mocks around the TUI. Prefer testing `runAgentTurn`, registry validation, scripted command behavior, and one non-interactive CLI smoke path.

## Debug Bundles

Use `research debug run <run-id>` for run failures. It emits a redacted JSON object with:

- CLI version and Node version
- redacted session metadata
- dashboard run URL
- tracked-run cache entry
- backend run payload
- results payload
- events payload
- artifacts payload

This bundle is intended for agents and engineers to debug failures without screenshots or manual dashboard inspection.

## Live Smoke Tests

Live tests against `alpharesearch.nyc` and DigitalOcean should be explicit manual smoke tests with real credentials. They do not belong in default CI because they are slower, stateful, and depend on external infrastructure.
