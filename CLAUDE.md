# Rush N Relax — Claude Code Instructions

> These are standing instructions for all Claude Code sessions in this project.
> Follow them exactly. They override default behavior.

---

## Stack

- **Framework**: Next.js 15 App Router, React 19, TypeScript (strict)
- **Hosting**: Vercel (PR previews + production)
- **Backend**: Firebase — Admin SDK for Firestore (server-only), Cloud Functions v2, Storage, Auth
- **Testing**: Vitest (unit), Playwright (E2E against Firebase emulators)
- **CI**: GitHub Actions — lint → type check → unit tests → E2E → deploy on merge to `main`

## Firestore Schema (flat root collections)

```
locations/{slug}
products/{slug}
promos/{slug}
inventory/{locationId}/items/{productId}
location-reviews/{placeId}
product-categories/{slug}
variant-templates/{docId}
contact-submissions/{docId}
pending-user-invites/{email}
outbound-emails/{docId}
email-templates/{templateId}
email-template-revisions/{docId}
vendors/{slug}
orders/{orderId}
```

All Firestore access is **server-side only** via Admin SDK. No client-side Firestore reads.

---

## Engineering Principles (project-specific additions)

> KISS, YAGNI, SOLID, and Scan-before-build apply globally — see `~/.claude/CLAUDE.md`.

4. **BDD** — tests describe user/system behavior, not implementation details
5. **Emulator-first** — all dev and CI work uses Firebase emulators (`localhost:8080`); never hit production Firestore for dev/test
6. **Branch → PR → main** — all changes via PR; direct pushes to `main` are blocked

## Code Standards

- **Repository pattern**: Firestore access only through `src/lib/repositories/`. Never inline `getFirestore()` in pages, components, or API routes.
- **No `any`**: every TypeScript escape hatch (`any`, `as`, `!`) requires an inline justification comment.
- **`satisfies` on Firestore mappings**: use `satisfies TypeName` on all `docToX()` return objects.

## Doc Update Rule

When any of these files change → `docs/engineering/` must be reviewed and updated in the same session:

- `src/types/`
- `src/lib/repositories/`
- `firestore.rules`
- `scripts/seed-*.ts` or `scripts/seed-*.cjs`

---

## BrewCortex Agents (globally available)

| Agent         | When to spawn                                                              |
| ------------- | -------------------------------------------------------------------------- |
| `strategist`  | Product direction, prioritization, what's next                             |
| `research`    | Web lookups, library comparisons, doc fetches (runs on Haiku — fast/cheap) |
| `engineering` | Complex multi-file code changes, refactors, bug hunts                      |
| `architect`   | System design, schema decisions, architectural trade-offs                  |
| `qa`          | Test strategy, coverage audits, BDD validation, missing test scenarios     |
