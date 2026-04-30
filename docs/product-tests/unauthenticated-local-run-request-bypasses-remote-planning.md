# unauthenticated local run request bypasses remote planning

## Product Use

A user asks to see active runs while no signed-in product session is available.

## Actions Taken

The product treats this as a local status request. It reads the local tracked-run state and does not start a planning flow or ask the user to sign in before showing what can be known locally.

## Assertions Made

- The first product action is `list_tracked_runs`.
- The final message is an assistant response.
- The request is handled without remote planning.
