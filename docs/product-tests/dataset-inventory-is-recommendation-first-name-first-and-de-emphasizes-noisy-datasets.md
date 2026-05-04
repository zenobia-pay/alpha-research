# dataset inventory is recommendation-first, name-first, and de-emphasizes noisy datasets

## Product Use

A user asks what datasets they have. The product should present a scannable inventory that foregrounds useful ready datasets and de-emphasizes draft, upload-test, or noisy internal datasets.

## Why This Test

Dataset choice is a core workflow. A raw id dump makes users choose from implementation details instead of product names, readiness, and likely next actions.

## Actions Taken

The harness returns a mixed catalog of ready, draft, uploaded, and noisy datasets.

## Assertions Made

The response is recommendation-first, shows human names before ids, indicates readiness, and avoids presenting noisy datasets as equally useful choices.
