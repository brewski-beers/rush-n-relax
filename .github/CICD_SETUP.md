# GitHub Actions CI/CD Setup

This project uses GitHub Actions to automate deployments to Firebase Hosting.

## Workflows

### 1. **Pull Request Preview** (`.github/workflows/firebase-hosting-pull-request.yml`)
- **Trigger**: When a PR is opened, synchronized, or reopened against `main`
- **Actions**:
  - Runs linter
  - Runs unit tests
  - Builds the project
  - Deploys to a Firebase preview channel
  - Posts preview URL as a comment on the PR
- **Preview expires**: 7 days after deployment

### 2. **Production Deployment** (`.github/workflows/firebase-hosting-merge.yml`)
- **Trigger**: When code is merged to `main`
- **Actions**:
  - Runs linter
  - Runs unit tests
  - Runs E2E tests (Playwright)
  - Builds the project
  - Deploys to Firebase Hosting production (`live` channel)

## Required GitHub Secrets

You must configure the following secrets in your GitHub repository:

### Navigate to: `Settings → Secrets and variables → Actions → New repository secret`

#### Firebase Service Account (Required)
```
FIREBASE_SERVICE_ACCOUNT_RUSH_N_RELAX
```
**How to get this:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`rush-n-relax`)
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Copy the entire JSON content and paste it as the secret value

#### Firebase Client SDK Configuration (Required)
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```
**How to get these:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **General** → **Your apps**
4. Find your web app config object
5. Add each value as a separate GitHub secret

**Current values** (from `.env` - these are safe to use in GitHub secrets as they're public client-side config):
- `VITE_FIREBASE_API_KEY`: `AIzaSyB0qrTVmQ8gRvmx-4oJ_dQHP6RA2kZ3FJk`
- `VITE_FIREBASE_AUTH_DOMAIN`: `rush-n-relax.firebaseapp.com`
- `VITE_FIREBASE_PROJECT_ID`: `rush-n-relax`
- `VITE_FIREBASE_STORAGE_BUCKET`: `rush-n-relax.firebasestorage.app`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: `556383052079`
- `VITE_FIREBASE_APP_ID`: `1:556383052079:web:6780513e5d7d79140f01da`

#### Google Maps API (Required)
```
VITE_GOOGLE_MAPS_API_KEY
```
**Current value**: `AIzaSyAcUo58FHBrCWyWiqDh_mzauM17ptqX7xM`

**How to get this:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Create or use existing API key
4. Ensure these APIs are enabled:
   - Maps Embed API
   - Maps JavaScript API

## Testing the Workflows

### Test PR Preview:
1. Create a new branch: `git checkout -b test/preview-deploy`
2. Make a small change (e.g., update README)
3. Push branch: `git push origin test/preview-deploy`
4. Open a Pull Request on GitHub
5. Wait for the workflow to complete (~2-3 minutes)
6. Check the PR for the preview URL comment

### Test Production Deploy:
1. Merge a PR to `main`
2. The production workflow will trigger automatically
3. Check the **Actions** tab on GitHub to monitor progress
4. Visit your production site after deployment completes

## Workflow Status Badges

Add these to your README to show build status:

```markdown
![Preview Deploy](https://github.com/brewski-beers/rush-n-relax/workflows/Deploy%20to%20Firebase%20Hosting%20Preview%20Channel/badge.svg)
![Production Deploy](https://github.com/brewski-beers/rush-n-relax/workflows/Deploy%20to%20Firebase%20Hosting%20Production/badge.svg)
```

## Troubleshooting

### "Resource not accessible by integration" error
- Ensure the `GITHUB_TOKEN` has proper permissions
- Go to **Settings → Actions → General → Workflow permissions**
- Select **Read and write permissions**

### "Firebase Service Account" authentication fails
- Verify the JSON service account key is complete and valid
- Ensure there are no extra spaces or newlines in the secret
- Re-download the service account key from Firebase Console

### Build fails with environment variable errors
- Double-check all `VITE_*` secrets are configured in GitHub
- Ensure secret names match exactly (case-sensitive)

### E2E tests fail in production workflow
- Playwright browsers are installed automatically in the workflow
- Check if tests pass locally: `npm run test:e2e`
- Review test logs in the GitHub Actions output

## Local Firebase Preview Testing

To test preview channels locally:
```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Build the project
npm run build

# Deploy to a preview channel
firebase hosting:channel:deploy preview-test --expires 1h

# View the preview URL
```

## Additional Resources

- [Firebase Hosting Preview Channels](https://firebase.google.com/docs/hosting/test-preview-deploy)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [FirebaseExtended/action-hosting-deploy](https://github.com/FirebaseExtended/action-hosting-deploy)
