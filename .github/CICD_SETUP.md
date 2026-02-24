# GitHub Actions CI/CD Setup

This project uses GitHub Actions to automate deployments to Firebase Hosting.

## Workflows

### 1. **Pull Request Preview** (`.github/workflows/firebase-hosting-pull-request.yml`)

- **Trigger**: When a PR is opened, synchronized, or reopened against `main`
- **Actions**:
  - Runs linter
  - Runs unit tests
  - Builds the project
  - Deploys Firestore rules, indexes, and Storage rules
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
  - Deploys Firestore rules, indexes, and Storage rules
  - Deploys to Firebase Hosting production (`live` channel)

## Required GitHub Secrets

You must configure the following secrets in your GitHub repository:

### Navigate to: `Settings → Secrets and variables → Actions → New repository secret`

#### Firebase Service Account (Required for Deployment)

```
FIREBASE_SERVICE_ACCOUNT_RUSH_N_RELAX
```

**How to get this:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`rush-n-relax`)
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Copy the entire JSON content and paste it as the secret value

#### Google Maps API (Required for Location Pages)

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

---

**Note**: Firebase client SDK configuration (API key, auth domain, project ID, etc.) is now **hardcoded in `src/firebase.ts`**. These values are public by design and are visible in all deployed JavaScript bundles. Security is enforced via Firebase Security Rules, not secrecy of these values. This eliminates the need to manage 8+ environment variables as GitHub secrets.

## What Gets Deployed

Both workflows deploy the complete Firebase configuration:

### Firestore

- **Rules** (`firestore.rules`): Database security rules
- **Indexes** (`firestore.indexes.json`): Query optimization indexes

### Storage

- **Rules** (`storage.rules`): File storage security rules

### Hosting

- **Preview Channel** (PRs): Temporary preview URL, expires in 7 days
- **Production** (main): Live site at your Firebase Hosting domain

**Note**: Functions are NOT automatically deployed by these workflows. Deploy functions manually with `npm run deploy` or add a separate workflow if needed.

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
