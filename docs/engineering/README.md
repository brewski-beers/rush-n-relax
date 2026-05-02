# Engineering Docs — Index

Module-level engineering references for Rush N Relax. Every doc here follows [`mermaid-standard.md`](./mermaid-standard.md): Neo Dark theme, scoped subgraphs, max 20 nodes, every diagram has a legend.

## Modules

| Doc                                                        | Scope                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| [`architecture.md`](./architecture.md)                     | System architecture, layer/tier boundaries, deploy topology.       |
| [`admin.md`](./admin.md)                                   | Admin app surface — orders list/detail, pagination, role gating.   |
| [`products.md`](./products.md)                             | Product schema, categories, variant templates, inventory model.    |
| [`vendors.md`](./vendors.md)                               | Vendor schema and ingest path.                                     |
| [`orders.md`](./orders.md)                                 | Order lifecycle, state machine, event log, webhook→status mapping. |
| [`agechecker.md`](./agechecker.md)                         | AgeChecker.Net integration — research + webhook handler runbook.   |
| [`clover-hosted-checkout.md`](./clover-hosted-checkout.md) | Clover Hosted Checkout — Path A vs B, current handler state.       |
| [`mermaid-standard.md`](./mermaid-standard.md)             | Diagram style guide. Every doc above complies.                     |

## Doc Update Rule

When any of these change → the matching doc must be reviewed and updated in the same session:

- `apps/web/src/types/` → `orders.md`, `products.md`, `vendors.md` (whichever applies)
- `apps/web/src/lib/repositories/` → matching module doc
- `apps/web/src/app/api/webhooks/**` → `agechecker.md` or `clover-hosted-checkout.md`
- `firestore.rules` → `architecture.md` + affected module doc
- `scripts/seed-*.ts` / `scripts/seed-*.cjs` → matching module doc
