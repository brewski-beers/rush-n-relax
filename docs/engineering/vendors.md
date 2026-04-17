# Vendors — Engineering Reference

> Last updated: 2026-04-17

## Firestore collection

`vendors/{slug}` — see src/types/vendor.ts for the full document shape.

Key fields:

- `isActive` (boolean) — only active vendors are shown on public pages
- `website` (string, optional) — external brand URL; rendered with rel="noopener noreferrer"
- `logoUrl` (string, optional) — Firebase Storage path; rendered as placeholder if absent
- `categories` (string[]) — category tags (edibles, vapes, etc.)
- `description` (string, optional) — public-facing vendor bio

## Repository

`src/lib/repositories/vendor.repository.ts`

| Function                          | Description                                                          |
| --------------------------------- | -------------------------------------------------------------------- |
| `listVendors()`                   | Active vendors only, ordered by name — used by public directory page |
| `listAllVendors()`                | All vendors regardless of status — admin use only                    |
| `getVendorBySlug(slug)`           | Single vendor by slug; returns null if not found                     |
| `upsertVendor(data)`              | Create or update; preserves createdAt on update                      |
| `setVendorActive(slug, isActive)` | Toggle active flag                                                   |

## Public pages

| Route             | File                                           |
| ----------------- | ---------------------------------------------- |
| `/vendors`        | `src/app/(storefront)/vendors/page.tsx`        |
| `/vendors/[slug]` | `src/app/(storefront)/vendors/[slug]/page.tsx` |

Both pages use `revalidate = 3600` (ISR, 1-hour cache).

The detail page (`/vendors/[slug]`):

- Calls `notFound()` if vendor is missing OR `isActive === false`
- Renders a product grid via `listProductsByVendor()` (see products.md)
- Shows a friendly empty state when no active products exist
- External website link uses `target="_blank" rel="noopener noreferrer"`

## Navigation

Vendors directory is linked from the site footer (`src/components/Footer/Footer.tsx`).
