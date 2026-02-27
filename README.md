# FCO Planning App

Editable planning trees backed by Firebase Auth + Firestore.

## What It Does

- Sign in or create an account (email/password + display name)
- Creates a root node for each user (example: `Francisco Valdez`)
- Build child trees for projects and subprojects
- Open any node as a local "master" view
- Jump back to a global "grandmother view" from the user root
- Add cross-reference bubbles (e.g., `MP`) that link shared entities across branches

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill Firebase keys:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Never commit real `.env` or `.env.production` files to git.

Run the local guard before pushing if you changed env/config files:

```bash
npm run guard:secrets
```

This guard blocks:
- tracked `.env*` files except `.env.example` and `.env.offline`
- high-risk secret patterns (Google API keys, private keys, GitHub tokens, Firebase CI token-like strings)

Optional PR-style scan against `main` (changed files only):

```bash
npm run guard:secrets:changed
```

Install local git hooks (recommended):

```bash
npm run hooks:install
```

This installs repo-managed hooks:
- `pre-commit` runs `guard:secrets`
- `pre-push` runs `check` (lint + typecheck)

Optional faster push loop for local-only work:

```bash
PRE_PUSH_FAST=1 git push
```

Fast mode runs `check:changed` (eslint on changed JS/TS files only).
If full pre-push checks are slow, the hook prints this hint automatically.
You can tune when the hint appears with `PRE_PUSH_HINT_THRESHOLD` (seconds).

3. Run locally:

```bash
npm run dev
```

## Firestore Structure

- `users/{uid}`: profile + `rootNodeId`
- `users/{uid}/nodes/{nodeId}`: editable tree nodes
- `users/{uid}/crossRefs/{refId}`: shared cross-reference bubbles
