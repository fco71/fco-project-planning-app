# FCO Planning App - Deployment Guide

## Firebase Hosting Setup

Your app is now configured for Firebase Hosting and ready to deploy!

### Prerequisites
- Firebase project: `fco-planning-app` (already configured)
- Firebase CLI installed (already installed as dev dependency)
- Environment variables configured locally (`.env` / `.env.production`) and not committed to git

### Deployment Steps

#### 0. Configure Environment Variables
Create local env files from `.env.example` as needed.

Do not commit `.env.production` or any real keys to the repository.

#### 1. Login to Firebase (First time only)
```bash
npx firebase login
```

#### 2. Build the Application
Before deploying, you need to rebuild the app with your latest changes:

```bash
npm run build
```

**Note**: If you encounter native binding errors with rolldown, try:
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### 3. Deploy to Firebase Hosting
```bash
npx firebase deploy --only hosting
```

Or deploy everything (Firestore rules + Hosting):
```bash
npx firebase deploy
```

### Your Site Will Be Live At
```
https://fco-planning-app.web.app
```
or
```
https://fco-planning-app.firebaseapp.com
```

### What's Been Configured

1. **firebase.json** - Updated with hosting configuration:
   - Public directory: `dist` (Vite build output)
   - SPA routing with rewrites to `/index.html`
   - Cache headers for static assets

2. **.firebaserc** - Project configuration:
   - Default project: `fco-planning-app`

3. **Recent Improvements**:
   - ✅ Smoother node interactions with spring-like animations
   - ✅ Draggable portal bubbles (cross-reference nodes)
   - ✅ Enhanced transitions and hover effects
   - ✅ Auto-save indicator when dragging nodes
   - ✅ Error boundaries for graceful failure handling
   - ✅ Snap-to-grid for cleaner node placement

### Quick Deploy Command
```bash
# Build and deploy in one go
npm run build && npx firebase deploy --only hosting
```

### Troubleshooting

**Build errors?**
- Delete `node_modules` and `package-lock.json`, then run `npm install`
- Make sure you're using Node.js 18 or higher

**Deploy errors?**
- Make sure you're logged in: `npx firebase login`
- Check your Firebase project exists: `npx firebase projects:list`
- Verify your .firebaserc points to the correct project

**Need to change project name?**
```bash
npx firebase use --add
```

### Continuous Deployment
Consider setting up GitHub Actions for automatic deployment:
1. Add `FIREBASE_TOKEN` to GitHub Secrets
2. Add all required `VITE_FIREBASE_*` values as GitHub Secrets for build-time env vars
3. Use the existing workflows in `.github/workflows/`

### Performance Tips
- All static assets are cached for 1 year
- Gzip compression is enabled by default
- Use Firebase Performance Monitoring to track load times

---

**Ready to deploy?** Run:
```bash
npx firebase deploy
```

Your planning app will be live at `https://fco-planning-app.web.app` 🚀
