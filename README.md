# Rush N Relax

E-commerce + admin platform for a 3-location TN dispensary chain (Oak Ridge, Maryville, Seymour) plus an online store.

| | |
|---|---|
| **Stack** | Next.js 15 App Router · React 19 · TypeScript (strict) · Firebase (Firestore via Admin SDK, Functions v2, Storage, Auth) · Tailwind CSS |
| **Hosting** | Vercel (PR previews + production) |
| **Payments** | Clover Hosted Checkout (Path B — merchant private token + return-URL reconciliation) |
| **ID verification** | AgeChecker.Net (HMAC-signed webhook) |
| **Email** | Resend, dispatched via Firebase Cloud Functions |
| **Testing** | Vitest (unit + BDD) · Playwright + playwright-bdd (E2E against Firebase emulators) |
| **CI/CD** | GitHub Actions — lint → typecheck → unit tests → E2E → deploy on merge to `main` |

---

## Repo layout

```
rush-n-relax/
├── apps/
│   └── web/              # Next.js app — storefront + admin
│       └── src/
│           ├── app/      # App Router routes
│           ├── components/
│           ├── constants/
│           ├── contexts/
│           ├── hooks/
│           ├── lib/      # Repos (Firestore Admin SDK), helpers
│           ├── types/    # Shared schema types
│           └── __tests__/
├── functions/            # Firebase Cloud Functions (v2)
├── tools/                # Project scripts (seed, purge, prune, etc.)
├── firestore.rules       # Firestore security rules
├── firestore.indexes.json
├── storage.rules         # Storage security rules
└── firebase.json         # Emulator + deploy config
```

All engineering documentation lives in the Obsidian vault — see "Engineering docs" below.

---

## Engineering docs

All deep engineering documentation lives in the **Obsidian vault** at `~/Documents/Obsidian Vault/projects/rush-n-relax/`. Highlights:

- `architecture.md` — system architecture, layer/tier boundaries, deploy topology
- `orders.md` — order lifecycle, state machine, event log
- `products.md` — product schema, variants, per-location stock
- `agechecker.md` — AgeChecker.Net runbook
- `clover-hosted-checkout.md` — Clover Path A vs B, current handler state
- `firebase-deploy-iam.md` — GHA WIF + Vercel runtime SA roles + rotation runbook
- `firebase-credentials-architecture.md` — full credential migration history

The vault uses Obsidian's wikilinks, Canvas, and Mermaid plugins for diagrams + cross-references that GitHub markdown can't render properly.

---

## Local development

### Prerequisites
- Node 22.x · pnpm 9.x · Firebase CLI · `gcloud` CLI (for IAM operations)

### First-time setup
```bash
pnpm install
firebase login
firebase use rush-n-relax
```

### Run with emulators (default)
```bash
pnpm dev:emulators   # spawns Firestore + Auth + Functions + Storage emulators
pnpm dev             # in another terminal — Next.js on http://localhost:3000
```

The app refuses to talk to production Firebase from local dev; emulator URLs are wired in `apps/web/src/lib/firebase/admin.ts`.

### Tests
```bash
pnpm test          # Vitest — unit + component + BDD (835 tests as of 2026-05-02)
pnpm test:e2e      # Playwright BDD against emulators
pnpm typecheck
pnpm lint
```

---

## Engineering principles

Apply project-wide. Defaults from KB's global `CLAUDE.md` + RnR-specific:

1. **KISS · YAGNI · SOLID · Scan-before-build** — search for existing implementations first
2. **BDD** — tests describe user/system behavior, not implementation details
3. **Emulator-first** — all dev and CI work uses Firebase emulators; never hit production Firestore for dev/test
4. **Branch → PR → main** — direct pushes to `main` are blocked
5. **Repository pattern** — Firestore access only via `apps/web/src/lib/repositories/*`. Never inline `getFirestore()` in pages, components, or API routes
6. **No `any`** — every TypeScript escape hatch (`any`, `as`, `!`) requires an inline justification
7. **`satisfies`** on Firestore mappings — every `docToX()` returns with `satisfies TypeName`

See [`CLAUDE.md`](./CLAUDE.md) for the project's Doc Update Rule and full agent routing guidance.

---

## Deployment

Production deploys on merge to `main` via the **Main — Verify & Deploy** workflow:
1. `verify` — lint, typecheck, unit tests
2. `deploy` — Firestore rules + indexes, Storage rules (via WIF auth)
3. Vercel — automatic on push (separate from the GHA workflow)

For credential rotation, IAM troubleshooting, and the Vercel SA key runbook, see [`firebase-deploy-iam.md`](file:///Users/kb/Documents/Obsidian%20Vault/projects/rush-n-relax/firebase-deploy-iam.md) in the vault.

---

## Locations

| Slug | Type |
|------|------|
| `oak-ridge` | Physical retail (Clover POS) |
| `maryville` | Physical retail (Clover POS) |
| `seymour` | Physical retail (Clover POS) |
| `online` | E-commerce only |

Each is a fully independent entity — separate inventory, separate Clover merchant. No central warehouse.

---

## Status

Active development. Order flow + admin order tracker are landed. In-flight: per-variant inventory rewrite (#304 chain). See open GitHub issues + the vault `snapshot.md` for current state.
