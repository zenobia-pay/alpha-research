# local dataset deletion confirms and then removes the selected instance

## Product Use

This product test exercises the CLI behavior for deleting a local dataset instance from the user's point of view.

## Why This Test

The scenario protects the local dataset management contract. If a user asks to delete a local dataset, the CLI should handle that local operation directly after confirmation instead of saying it cannot touch local files.

## Actions Taken

The deterministic harness provides one local dataset, asks to delete it, confirms the deletion, and verifies that the local delete dependency is called with the selected instance id.

## Assertions Made

- The CLI asks for confirmation before deleting the local dataset.
- A `yes` confirmation removes the selected local instance.
- The final message reports that the local dataset was deleted.
- The flow avoids remote model planning for this local filesystem action.
