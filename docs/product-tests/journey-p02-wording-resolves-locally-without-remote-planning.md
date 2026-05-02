# journey P02 wording resolves locally without remote planning

## Product Use

The journey wording for a basic product-orientation prompt should be handled as a local help request. The user is trying to understand the product, not start a remote run.

## Why This Test

Journey prompts are used to evaluate the product experience. If simple orientation routes through remote planning, the UI can appear slow or fail for reasons unrelated to the user's task.

## Actions Taken

The test sends the P02-style wording through the agent with a fake remote client.

## Assertions Made

The response is generated locally, gives clear next steps, and does not call remote planning or dataset tools.
