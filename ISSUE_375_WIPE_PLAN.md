# Issue #375 — Wipe products/_ and inventory/_ in prod

## Code Cleanup Status

**ALREADY COMPLETE** — PR #390 (commit `c6f0fde`)

The following files were deleted in commit `c6f0fde`:

- `scripts/migrate-inventory-into-products.ts` (migration script)
- `apps/web/src/lib/repositories/inventory.repository.ts` (repository)
- `apps/web/src/types/inventory.ts` (type definitions)
- Inventory rule block removed from `firestore.rules`
- Inventory-related unit tests deleted (admin inventory, decrement, repository tests)
- All call sites migrated to Product variantSpecs model

Code cleanup requires NO further action — this PR simply documents completion for closure.

---

## Firestore Data Wipe (operational, KB to execute)

### Pre-wipe safety backup

Create a Firestore export snapshot to GCS before any deletions:

```bash
# Create dedicated export bucket (if not already present)
gsutil mb -p rush-n-relax -c STANDARD -l US-CENTRAL1 \
  gs://rush-n-relax-firestore-exports/

# Export Firestore to GCS (timestamp-based backup)
gcloud firestore export gs://rush-n-relax-firestore-exports/backup-$(date +%Y%m%d-%H%M%S) \
  --project=rush-n-relax

# Monitor export progress
gcloud firestore operations list \
  --project=rush-n-relax \
  --filter="done=false"
```

**Export URI placeholder for PR body:**

```
gs://rush-n-relax-firestore-exports/backup-YYYYMMDD-HHMMSS
```

KB: update the timestamp once you execute the export; link the actual URI in the completed PR.

---

### Delete inventory/\* collection

```bash
# Delete entire inventory collection
gcloud firestore databases delete-collection inventory \
  --project=rush-n-relax \
  --quiet
```

---

### Delete products/\* collection

```bash
# Delete entire products collection
gcloud firestore databases delete-collection products \
  --project=rush-n-relax \
  --quiet
```

---

### Verification

After both deletions, verify the wipe and confirm other collections are untouched:

```bash
# List all root collections (should exclude products and inventory)
gcloud firestore databases list-collections \
  --project=rush-n-relax

# Expected collections:
# - locations
# - product-categories
# - vendors
# - variant-templates
# - promos
# - orders
# - contact-submissions
# - pending-user-invites
# - location-reviews
# - email-templates
# - email-template-revisions
# - outbound-emails
# - checkout-sessions
# - order-events

# Count documents in critical collections to confirm they're untouched
echo "=== location-reviews count ===" && \
  gcloud firestore documents list location-reviews --page-size=1 --project=rush-n-relax | tail -1

echo "=== locations count ===" && \
  gcloud firestore documents list locations --page-size=1 --project=rush-n-relax | tail -1

echo "=== product-categories count ===" && \
  gcloud firestore documents list product-categories --page-size=1 --project=rush-n-relax | tail -1

echo "=== vendors count ===" && \
  gcloud firestore documents list vendors --page-size=1 --project=rush-n-relax | tail -1

echo "=== variant-templates count ===" && \
  gcloud firestore documents list variant-templates --page-size=1 --project=rush-n-relax | tail -1

echo "=== promos count ===" && \
  gcloud firestore documents list promos --page-size=1 --project=rush-n-relax | tail -1

echo "=== orders count ===" && \
  gcloud firestore documents list orders --page-size=1 --project=rush-n-relax | tail -1
```

---

## Decision: Keep promos/\* untouched

Per KB instruction: **promos/\* collection will remain in prod**. This PR does NOT wipe promo data.

---

## Acceptance Criteria (repo side)

- [x] Code cleanup verified complete (PR #390)
- [ ] Export backup URI documented in PR body
- [ ] Command sequence provided and reviewed by KB
- [ ] Vault doc `[[firebase-deploy-iam]]` updated with export bucket details

---

## Related

- **PR #390**: Complete code cleanup (deletion of inventory repo, types, migration script)
- **Vault**: `~/Documents/Obsidian Vault/projects/rush-n-relax/firebase-deploy-iam.md`
- **GCS backup bucket**: `gs://rush-n-relax-firestore-exports/`
