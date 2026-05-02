# stuck run question explains fresh booting run in plain language

## Product Use

A user asks whether a fresh booting run is stuck. The product should explain that booting can be normal before escalating.

## Why This Test

Prematurely calling fresh provisioning stuck creates noise. Users need calibrated status based on age and state.

## Actions Taken

The harness provides a recently updated booting run and asks a stuck-run question.

## Assertions Made

The response describes the run as fresh or still starting, gives the run id, and suggests inspection without over-escalating.
