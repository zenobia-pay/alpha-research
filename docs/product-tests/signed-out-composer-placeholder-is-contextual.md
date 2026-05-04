# signed-out composer placeholder is contextual

## Product Use

The TUI composer renders with and without an authenticated session.

## Why This Test

This protects the first text field a user sees. It should guide signed-out users toward sign-in while giving signed-in users artifact and run affordances.

## Actions Taken

The test calls the placeholder helper for null session and active session states.

## Assertions Made

The signed-out placeholder mentions datasets, runs, or sign-in. The signed-in placeholder mentions datasets, runs, or artifacts.
