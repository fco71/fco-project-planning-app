# GitHub Actions Setup Guide (Updated for Token Authentication)

GitHub Actions workflows have been created for automatic deployment using Firebase CLI tokens!

## What's Been Created

✅ `.github/workflows/firebase-hosting-merge.yml` - Auto-deploy on push to `main`  
✅ `.github/workflows/firebase-hosting-pull-request.yml` - Preview deployments for PRs
✅ CI secret guard that blocks tracked sensitive `.env` files (except `.env.example` and `.env.offline`)
✅ CI high-signal secret pattern scan on tracked files (Google API key/private key/GitHub token/Firebase CI token-like patterns)
✅ CI secret scan modes: PRs scan changed files, `main`/manual runs scan all tracked files
✅ Optional local hook installer: `npm run hooks:install` (pre-commit staged secret guard + pre-push lint/typecheck, with optional `PRE_PUSH_FAST=1` changed-file lint mode)
✅ Local hook verifier: `npm run hooks:verify`

## Setup Steps (Simplified!)

### 1. Generate Firebase CLI Token

Run this command in your terminal:
```bash
npx firebase login:ci
```

This will:
- Open your browser to authenticate with Firebase
- Generate a CI token
- Display the token in your terminal

**⚠️ IMPORTANT:** Copy the token immediately - it looks like: `1//0gXXXXXXXXXXX`

### 2. Add Token to GitHub Repository

1. Go to: https://github.com/fco71/fco-project-planning-app/settings/secrets/actions
2. Click **"New repository secret"**
3. Name: `FIREBASE_TOKEN` (exactly as shown)
4. Value: Paste the token from step 1
5. Click **"Add secret"**

### 3. Add Build Secrets for Vite

Add these repository secrets in the same GitHub Secrets page:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `E2E_EMAIL` (required for full authenticated Playwright smoke coverage)
- `E2E_PASSWORD` (required for full authenticated Playwright smoke coverage)

These are required for `npm run build` in GitHub Actions.
`E2E_EMAIL` and `E2E_PASSWORD` allow the CI Playwright workflow to run signed-in planner smoke coverage instead of skipping auth-required tests.
On `push` to `main` and `workflow_dispatch`, CI now fails if those two secrets are missing.
On pull requests, CI warns and continues, but auth-required tests are skipped when credentials are absent.

### 4. Push Workflow Files to GitHub

```bash
git add .github/
git commit -m "Add GitHub Actions for automatic Firebase deployment"
git push origin main
```

### 5. Watch It Deploy! 🎉

Once you push:
1. Go to: https://github.com/fco71/fco-project-planning-app/actions
2. Click on the running workflow
3. Watch your app build and deploy automatically!

## How It Works

### On Push to Main Branch
- **Triggers**: Every push to `main`
- **Actions**: 
  1. Checkout code
  2. Install dependencies
  3. Build the app
  4. Deploy to production
- **Result**: Live at `https://fco-planning-app.web.app`

### On Pull Requests
- **Triggers**: When you create/update a PR
- **Actions**: 
  1. Checkout code
  2. Install dependencies
  3. Build the app
  4. Deploy to preview channel
- **Result**: Get a unique preview URL like `https://fco-planning-app--pr-123-xxxxx.web.app`

## Why Token Instead of Service Account?

Your Firebase project has organization policies that prevent service account key creation. The Firebase CLI token method:
- ✅ Simpler to set up (one command)
- ✅ Works with all Firebase features
- ✅ Doesn't require downloading JSON files
- ✅ Perfect for personal projects
- ✅ Can be regenerated anytime with `firebase login:ci`

## Testing Locally

You can test deployments work before pushing:
```bash
# Make sure you're logged in
npx firebase login

# Test build
npm run build

# Test deploy
npx firebase deploy --only hosting
```

## Troubleshooting

**Workflow fails with "FIREBASE_TOKEN not found"**
- Make sure you added the secret with exact name: `FIREBASE_TOKEN`
- Verify you copied the entire token (they're long!)

**Build fails in GitHub Actions**
- Check that `npm run build` works locally first
- Verify all required `VITE_FIREBASE_*` secrets are present in repo settings
- View detailed logs in the Actions tab

**Deploy succeeds but site doesn't update**
- Clear your browser cache (Cmd+Shift+R on Mac)
- Check the deployed URL in the workflow logs

**Token expires**
- Firebase tokens don't expire by default
- If needed, regenerate with `firebase login:ci` and update the secret

## Token Security

🔒 Your Firebase token is:
- Encrypted in GitHub Secrets
- Never exposed in logs
- Only accessible to workflow runs
- Can be revoked anytime in Firebase Console

## Next Steps

Once set up, your workflow is:
1. Make changes to your code
2. Commit: `git commit -m "Add new feature"`
3. Push: `git push origin main`
4. ✨ **Site automatically updates!**

No more manual builds or deploys! 🚀

---

**Ready to enable auto-deployment?**

Run: `npx firebase login:ci`
Copy the token, add it to GitHub, push the workflows, and you're done!
