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
contact-submissions/{docId}
pending-user-invites/{email}
outbound-emails/{docId}
email-templates/{templateId}
email-template-revisions/{docId}
```

All Firestore access is **server-side only** via Admin SDK. No client-side Firestore reads.

---

## Engineering Principles (non-negotiable)

1. **KISS** — simplest working solution; no speculative complexity
2. **YAGNI** — don't build what isn't needed today
3. **SOLID** — Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion applied to modules and repositories
4. **BDD** — tests describe user/system behavior, not implementation details
5. **Emulator-first** — all dev and CI work uses Firebase emulators (`localhost:8080`); never hit production Firestore for dev/test
6. **Branch → PR → main** — all changes via PR; direct pushes to `main` are blocked

## Code Standards

- **Scan before build**: before proposing any new file, function, component, or abstraction, search the codebase for an existing implementation. Re-use what exists. Proposing to build something that already exists is a YAGNI violation.
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

## Auto-Skill Rules

Apply these automatically without being asked:

- After editing `src/types/`, `src/lib/repositories/`, or `firestore.rules` → apply `/architect` then `/doc-writer` thinking
- After writing or editing any `.ts`/`.tsx` file → apply `/quality` thinking
- After any significant feature or refactor → apply `/debt` check before declaring done
- Before any content (promo/product) is written to Firestore → apply `/compliance` thinking
- After editing `.github/workflows/` or `package.json` scripts → apply `/devops` thinking
- Before creating a branch, PR, or merge → apply `/git` thinking

---

## Digital Team Skills

Invoke these for structured, formal audits:

| Command         | Expert                   | When                                                  |
| --------------- | ------------------------ | ----------------------------------------------------- |
| `/quality`      | Code Quality Officer     | Code reviews, PR checks, refactor audits              |
| `/architect`    | Firebase Architect       | Schema changes, Firestore paths, rules, query design  |
| `/doc-writer`   | Technical Writer         | After code changes that affect architecture or schema |
| `/compliance`   | Legal Compliance Officer | Before publishing promo or product content            |
| `/frontend-seo` | Frontend & SEO Developer | UI changes, metadata, page structure                  |
| `/qa`           | QA Engineer              | Missing tests, test strategy, coverage gaps           |
| `/security`     | Security Auditor         | Auth flows, Firestore rules, API routes               |
| `/perf`         | Performance Engineer     | SSR/CSR decisions, bundle size, query cost            |
| `/release`      | Release Manager          | Commit messages, PR descriptions, deploy checklists   |
| `/devops`       | DevOps Engineer          | CI/CD workflows, emulator config, GitHub Actions      |
| `/git`          | GitHub Resident Expert   | Branch naming, PR lifecycle, Dependabot, repo hygiene |
| `/debug`        | Debugger                 | Root-cause analysis for runtime/type/query errors     |
| `/plan-feature` | Project Planner          | Breaking down features against the phase roadmap      |
| `/debt`         | Tech Debt Auditor        | Before merging any PR; score must be ≥8 to merge      |
