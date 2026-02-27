# Security Policy

## Supported Branch

- `main` (latest) is the only supported branch for security fixes.

## Reporting a Vulnerability

Do not open a public issue for credential leaks or vulnerabilities.

Use a private channel:
- GitHub Security Advisory (preferred), or
- direct contact with the repository owner/maintainer.

When reporting, include:
- affected file/path and commit (if known),
- impact and possible exploit path,
- reproduction steps,
- whether secrets/credentials were exposed.

## Credential Leak Response Runbook

If any key/token is exposed in git, logs, screenshots, or public URLs:

1. Revoke or rotate immediately.
2. Replace secrets in GitHub Actions (`Settings` -> `Secrets and variables` -> `Actions`).
3. Remove exposed values from repo history if needed.
4. Review provider logs for abuse and unusual usage.
5. Redeploy and validate auth/API flows.
6. Document incident date, scope, and mitigation.

## Google/Firebase Specific Actions

- Google API key:
  - Rotate in Google Cloud Console -> APIs & Services -> Credentials.
  - Apply restrictions (HTTP referrer/IP/API restrictions).
- Firebase token or CI token:
  - Revoke and regenerate.
  - Update `FIREBASE_TOKEN` and any impacted CI secrets.
- Firebase app env values:
  - Ensure only safe public config is in `.env.example`.
  - Never commit real `.env`/`.env.production`.

## Local and CI Guards (This Repo)

- Local pre-commit: staged secret scan.
- Local pre-push: lint + typecheck (with optional fast mode).
- CI:
  - secret scan on PR changed files,
  - full secret scan on main/manual/nightly runs,
  - nightly authenticated E2E run (requires `E2E_EMAIL` + `E2E_PASSWORD`).
