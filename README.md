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

3. Run locally:

```bash
npm run dev
```

## Firestore Structure

- `users/{uid}`: profile + `rootNodeId`
- `users/{uid}/nodes/{nodeId}`: editable tree nodes
- `users/{uid}/crossRefs/{refId}`: shared cross-reference bubbles
