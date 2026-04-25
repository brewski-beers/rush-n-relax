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

Source of truth: `~/Developer/BrewCortex/.claude/agents/`. Current roster (16 agents):

| Agent          | When to spawn (RnR-specific notes)                                                                |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `strategist`   | Product direction, prioritization, what's next for RnR                                            |
| `architect`    | System design, Firestore schema decisions, infra trade-offs                                       |
| `engineering`  | Multi-file code changes, refactors, bug hunts (default for code work)                             |
| `qa`           | Test strategy, coverage audits, BDD validation, missing scenarios                                 |
| `research`     | Web lookups, library comparisons, doc fetches (Haiku — fast/cheap)                                |
| `website`      | UI audit, component generation, a11y, SEO, CSS architecture for the storefront                    |
| `copy`         | Landing page copy, CTAs, product descriptions, email/SMS messaging                                |
| `firebase`     | Firestore rules, Auth config, Cloud Functions, Storage rules, emulator, security audits           |
| `vercel`       | Vercel config, env vars, build settings, edge functions, domain wiring                            |
| `monitoring`   | Vercel deployment health, function errors, Cloudflare DNS/CDN, prod incident triage               |
| `github`       | GitHub Actions spend, CI/CD health, Dependabot PRs, workflow auth (WIF)                           |
| `partner`      | Not typically used for RnR (client-facing proposals/SOWs)                                         |
| `mobile`       | **Not applicable** — RnR has no native app. Skip.                                                 |
| `worker`       | Issue-queue automation; invoked via `/work`. Never bypass for issue-driven work.                  |
| `orchestrator` | Multi-agent coordination across long-running initiatives                                          |
| `heartbeat`    | Scheduled / cron-triggered checks                                                                 |

## Parallel Work

For batched issue work, use `/work-parallel` — fans out multiple worker agents over independent worktrees, each opening its own PR. Use when 2+ unrelated issues are queued and won't conflict on the same files. Single-ticket work still goes through `/work`.

---

## Vault Knowledge to Load

On session start, load these for context (see global CLAUDE.md for the `cat $KNOWLEDGE/$domain.md` pattern):

**Cross-project domain knowledge** (`/Users/kb/Documents/Obsidian Vault/knowledge/`):

- `firebase.md` — Admin SDK, Firestore, Functions, emulator patterns
- `nextjs.md` — App Router, Server Components, Server Actions
- `react.md` — React 19 patterns
- `typescript.md` — strict-mode patterns, no-any conventions
- `testing.md` — Vitest + Playwright patterns
- `vercel.md` / `vercel-cloudflare.md` — hosting + DNS
- `ci-github-actions.md` — workflow patterns, WIF
- `secrets-rotation.md` — credentials lifecycle (RnR uses WIF + `vercel-runtime` SA)
- `seo.md`, `css-design.md` — storefront work

**Project-specific** (`/Users/kb/Documents/Obsidian Vault/projects/rush-n-relax/`):

- `patterns.md` — accumulated RnR patterns and gotchas
- `codex.md` — RnR architecture codex
- `firebase-credentials-architecture.md` — WIF + runtime SA design
- `snapshot.md` — current state snapshot
- `handoff-*.md` — open handoff notes (see Active Handoffs below)

## Active Handoffs

- [[handoff-self-documentation]]

---

## Local Setup — MCP Secrets

`.mcp.json` is a symlink to `~/Developer/BrewCortex/.mcp.json` (shared across all KB projects). It uses env-var interpolation for secrets — no live keys are committed.

To enable the Obsidian MCP server locally, export `OBSIDIAN_API_KEY` in your shell profile:

```bash
# ~/.zshrc
export OBSIDIAN_API_KEY="<your-obsidian-local-rest-api-key>"
```

Get the key from Obsidian → Settings → Community Plugins → Local REST API → API Key.

Never commit a literal value into `.mcp.json`. If a new MCP server needs a secret, follow the same `${ENV_VAR}` pattern.
