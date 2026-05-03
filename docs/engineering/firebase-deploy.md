# Firebase Deploy — IAM Permissions & Runbooks

> Reference for the GitHub Actions Firebase deploy pipeline. Captures the IAM
> roles required by the WIF service account and the runbook for rotating the
> Vercel runtime service account key.
>
> Last verified: 2026-05-02 (after #318 merge surfaced the missing
> `roles/datastore.owner` on the WIF SA).

---

## Two distinct credential paths to GCP

| Path | Service Account | Auth method |
|------|-----------------|-------------|
| GitHub Actions (Firebase deploy) | `firebase-adminsdk-fbsvc@rush-n-relax.iam.gserviceaccount.com` | Workload Identity Federation — pool `rush-n-relax-wif`, provider `github-provider` |
| Vercel runtime (Server Components / Server Actions / API routes) | `vercel-runtime@rush-n-relax.iam.gserviceaccount.com` | Static SA key in Vercel env var `FIREBASE_SERVICE_ACCOUNT_JSON` |

The WIF setup eliminated the static `FIREBASE_SERVICE_ACCOUNT_RUSH_N_RELAX`
GitHub secret. Do not re-add it.

---

## GHA WIF service account — required IAM roles

`firebase-adminsdk-fbsvc` needs the following roles to run the
`Main — Verify & Deploy` workflow's `deploy` job end-to-end:

| Role | Why |
|------|-----|
| `roles/cloudfunctions.admin` | Deploy Cloud Functions (e.g. `outbound-emails` trigger) |
| `roles/cloudscheduler.admin` | Schedule Pub/Sub triggers (e.g. recovery cron in #279) |
| `roles/firebaseauth.admin` | Manage Firebase Auth config |
| `roles/firebasedatabase.admin` | Realtime Database (legacy, retained) |
| `roles/firebasehosting.admin` | Firebase Hosting (legacy, retained) |
| `roles/firebaserules.admin` | Deploy `firestore.rules` and `storage.rules` |
| `roles/firebasestorage.admin` | Manage Storage buckets |
| **`roles/datastore.owner`** | Deploy Firestore composite indexes (`firestore.indexes.json`) |
| `roles/iam.serviceAccountTokenCreator` | WIF token exchange |
| `roles/iam.serviceAccountUser` | Allow GHA to act as this SA |
| `roles/secretmanager.secretAccessor` | Read CF runtime secrets |
| `roles/storage.admin` + `roles/storage.objectAdmin` | Storage operations |

### Why `datastore.owner` and not `datastore.indexAdmin`

`firebase deploy --only firestore:indexes` calls the v1 Firestore Admin API at:
```
firestore.googleapis.com/v1/projects/<project>/databases/(default)/collectionGroups/<id>/indexes
```

That endpoint requires `roles/datastore.owner` (or a custom role with the
equivalent `datastore.indexes.create` / `datastore.indexes.delete`
permissions). `roles/datastore.indexAdmin` covers only the legacy Datastore
index API, which is a different code path even for projects in Firestore
Native mode.

### Symptom of missing role

```
Error: Request to https://firestore.googleapis.com/v1/projects/rush-n-relax/databases/(default)/collectionGroups/orders/indexes had HTTP Error: 403, The caller does not have permission
```

### Fix

```bash
gcloud projects add-iam-policy-binding rush-n-relax \
  --member="serviceAccount:firebase-adminsdk-fbsvc@rush-n-relax.iam.gserviceaccount.com" \
  --role="roles/datastore.owner" \
  --condition=None
```

Then retry the failed deploy:
```bash
gh run rerun <run_id> --repo brewski-beers/rush-n-relax --failed
```

IAM propagation is usually <1 minute.

---

## Vercel runtime SA — key rotation runbook

`vercel-runtime` SA has narrow scope: `roles/datastore.user` +
`roles/firebaseauth.admin`. Static key is mounted in Vercel as
`FIREBASE_SERVICE_ACCOUNT_JSON` across Production, Preview, and Development.

### When to rotate

- Quarterly cadence (calendar reminder)
- Suspected exposure (key leaked in a log, repo, etc.)
- After a developer with `gcloud` access to this SA leaves

### Working manual rotation

The documented sync workflow at `.github/workflows/sync-firebase-key.yml`
has a YAML bug — the `${{ inputs.sa_key_json }}` interpolation breaks bash
quoting on multiline JSON (jq exits 5). Until the YAML is fixed, use this
manual flow:

```bash
# 1. Generate fresh key
gcloud iam service-accounts keys create /tmp/sa.json \
  --iam-account=vercel-runtime@rush-n-relax.iam.gserviceaccount.com \
  --project=rush-n-relax

# 2. Push to all three Vercel envs
#    NB: empty positional branch arg "" required for piped stdin on CLI v52
#    NB: --sensitive is rejected on development env
cd ~/Developer/rush-n-relax

vercel env rm FIREBASE_SERVICE_ACCOUNT_JSON preview --yes 2>/dev/null || true
vercel env add FIREBASE_SERVICE_ACCOUNT_JSON preview "" --sensitive < /tmp/sa.json

vercel env rm FIREBASE_SERVICE_ACCOUNT_JSON production --yes
vercel env add FIREBASE_SERVICE_ACCOUNT_JSON production --sensitive < /tmp/sa.json

vercel env rm FIREBASE_SERVICE_ACCOUNT_JSON development --yes
vercel env add FIREBASE_SERVICE_ACCOUNT_JSON development < /tmp/sa.json

# 3. Trigger redeploy (e.g. push an empty commit, or use vercel redeploy)
vercel redeploy <latest-prod-deploy-url>

# 4. Revoke prior user-managed keys
gcloud iam service-accounts keys list \
  --iam-account=vercel-runtime@rush-n-relax.iam.gserviceaccount.com \
  --project=rush-n-relax

gcloud iam service-accounts keys delete <old_key_id> \
  --iam-account=vercel-runtime@rush-n-relax.iam.gserviceaccount.com \
  --project=rush-n-relax \
  --quiet

# 5. Cleanup local copy
rm -f /tmp/sa.json
```

### Notes

- GCP-managed keys (those with `EXPIRES_AT` ~10-day windows) cannot be
  manually deleted. They auto-rotate.
- `vercel env pull` returns empty strings for sensitive vars in CLI v52 — you
  cannot copy a sensitive value from one env to another via pull/parse. Always
  source from the original (e.g. `gcloud iam service-accounts keys create`).
- Vercel preview deploys get dynamic per-deploy hostnames — `VERCEL_URL` is
  auto-injected. Prefer `VERCEL_URL` over `NEXT_PUBLIC_SITE_URL` when
  computing redirect URLs in code.

---

## Pro upgrade — eliminate static key entirely

When KB upgrades Vercel to Pro, enable OIDC Federation and set three env vars:
- `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`
- `GCP_PROJECT_ID`

The dormant code in `apps/web/src/lib/firebase/admin.ts` activates
automatically and the static-key path becomes unused. Then retire
`vercel-runtime` SA and delete the `FIREBASE_SERVICE_ACCOUNT_JSON` env var
from all three Vercel environments.

---

## Required GitHub secrets

| Secret | Scope | Rotation |
|--------|-------|----------|
| `VERCEL_TOKEN` | Team-scoped | 90 days |
| `VERCEL_PROJECT_ID` | — | Stable |
| `VERCEL_TEAM_ID` | — | Stable |

---

## Related

- `docs/engineering/orders.md` — Firestore composite indexes added in #289
- `reference_credentials_architecture.md` (KB's local memory)
- `reference_vercel_preview_env.md` (KB's local memory)
- `~/Documents/Obsidian Vault/projects/rush-n-relax/firebase-credentials-architecture.md` (full migration history)
