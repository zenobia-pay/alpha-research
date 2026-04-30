# test:slow:econ

## Product Use

An engineer validates the full economics product journey.

## Why This Test

This protects the staged economics journey as a suite, ensuring the individual stages work together from discovery through hypothesis analysis.

## Actions Taken

The product runs discovery, normalization planning, normalization execution, environment orchestration, and hypothesis analysis in order.

The staged journey also proves that handoff artifacts survive between stages. Discovery and planning outputs, especially `source_registry.plan.json`, must remain available in the mounted economics dataset for acquisition and normalization.

The journey treats credential-challenge endpoints as gated handoff state, not as active public data that can block all downstream work.

The normalization-execution stage uses a bounded representative public acquisition batch so the suite proves real fetching, normalization, and QA without requiring every public catalog source to complete in one live test.

## Assertions Made

- Every economics stage reaches its expected success criteria.
- Source-registry handoff state survives from discovery/planning into execution.
- Gated endpoints are excluded from active-source fetch success criteria.
- Bounded public-source acquisition still produces real normalized rows and QA artifacts.
- The journey moves from source discovery to usable hypothesis artifacts.
- A failure in any stage fails the economics suite.
