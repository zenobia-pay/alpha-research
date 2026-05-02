# signed-out composer placeholder is contextual

## Product Use

The composer placeholder changes based on whether the user is signed in. Signed-out users need a prompt that points them toward sign-in or local dataset questions; signed-in users can be invited to ask about datasets, runs, or artifacts.

## Why This Test

The first empty-state text is part of the product surface. If it suggests unavailable remote actions while signed out, the user can start with a failing path.

## Actions Taken

The test calls the placeholder helper with no session and with a valid session.

## Assertions Made

The signed-out placeholder mentions datasets, runs, or sign-in. The signed-in placeholder focuses on datasets, runs, and artifacts without unnecessary authentication recovery text.
