# Products — Engineering Reference

> Last updated: 2026-04-15
> Covers: schema, repository mappings, storefront data flow, COA lifecycle

---

## Firestore Path

```
products/{slug}
```

The document ID is the product slug (e.g., `blue-dream`). All Firestore access goes through `src/lib/repositories/product.repository.ts` — never inline in pages or components.

---

## `Product` Interface

Full type definition lives at `src/types/product.ts`.

| Field                 | Type                 | Required | Purpose                                                                |
| --------------------- | -------------------- | -------- | ---------------------------------------------------------------------- |
| `id`                  | `string`             | Yes      | Firestore document ID (same as `slug`)                                 |
| `slug`                | `string`             | Yes      | URL-safe identifier, e.g. `blue-dream`                                 |
| `name`                | `string`             | Yes      | Display name                                                           |
| `category`            | `string`             | Yes      | Category slug, e.g. `flower`                                           |
| `description`         | `string`             | Yes      | Short marketing copy (hero text)                                       |
| `details`             | `string`             | Yes      | Long-form copy (accordion)                                             |
| `image`               | `string?`            | No       | Firebase Storage path for featured image                               |
| `images`              | `string[]?`          | No       | Storage paths for gallery (up to 5)                                    |
| `status`              | `ProductStatus`      | Yes      | `active` \| `pending-reformulation` \| `archived` \| `compliance-hold` |
| `federalDeadlineRisk` | `boolean`            | Yes      | Nov 2026 federal hemp re-definition flag                               |
| `coaUrl`              | `string?`            | No       | Signed Storage URL for Certificate of Analysis PDF                     |
| `availableAt`         | `string[]`           | Yes      | Location slugs where product is stocked                                |
| `vendorSlug`          | `string?`            | No       | Reference to `vendors/{slug}`                                          |
| `labResults`          | `LabResults?`        | No       | THC%, CBD%, terpenes, test date, lab name                              |
| `descriptionSource`   | `DescriptionSource?` | No       | `leafly` \| `manual` \| etc.                                           |
| `leaflyUrl`           | `string?`            | No       | Leafly product page URL                                                |
| `strain`              | `ProductStrain?`     | No       | `indica` \| `sativa` \| `hybrid` \| `cbd`                              |
| `effects`             | `string[]?`          | No       | Consumer-facing effect descriptors                                     |
| `flavors`             | `string[]?`          | No       | Flavor descriptors                                                     |
| `whatToExpect`        | `string[]?`          | No       | Bullet sentences describing the experience                             |
| `effectScores`        | `EffectScores?`      | No       | Numeric 0–100 scores for 6 effect dimensions                           |
| `createdAt`           | `Date`               | Yes      | Document creation timestamp                                            |
| `updatedAt`           | `Date`               | Yes      | Last modification timestamp                                            |

### `EffectScores` shape

All fields optional — only written to Firestore if at least one score is set.

| Field        | Type      | Range |
| ------------ | --------- | ----- |
| `relaxation` | `number?` | 0–100 |
| `energy`     | `number?` | 0–100 |
| `creativity` | `number?` | 0–100 |
| `euphoria`   | `number?` | 0–100 |
| `focus`      | `number?` | 0–100 |
| `painRelief` | `number?` | 0–100 |

---

## `ProductSummary` vs `Product`

`ProductSummary` is a `Pick<Product, ...>` of the lightweight fields used in list views, inventory tables, and the related-products strip.

**Use `ProductSummary` when:** rendering product cards, inventory items, the admin products list, or any context where the full detail is not needed.

**Use `Product` when:** rendering the product detail page, admin edit form, or any context that needs lab results, effectScores, flavors, whatToExpect, or coaUrl.

`ProductSummary` fields:

```
id, slug, name, category, description, image, images, status, availableAt, vendorSlug, strain
```

`strain` is included on `ProductSummary` so the storefront related-products strip can render strain badges without fetching the full product.

---

## `docToProduct` / `docToProductSummary` — Defensive Mapping Patterns

All field mapping is defensive to protect against missing or malformed Firestore data (legacy products predate many fields).

| Pattern                                                 | Applied to                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `?? undefined`                                          | Scalar optional fields                                                         |
| `?? ''` or `?? []`                                      | Required scalars/arrays with safe defaults                                     |
| `Array.isArray(d.x) ? d.x as string[] : undefined`      | All `string[]` fields                                                          |
| `typeof d.x === 'string' && VALID_SET.has(d.x)`         | Enum scalars (`strain`, `status`)                                              |
| `typeof d.x === 'number' ? d.x : undefined`             | Numeric fields                                                                 |
| Nested object guard + cast to `Record<string, unknown>` | `labResults`, `effectScores`                                                   |
| `satisfies Product` / `satisfies ProductSummary`        | All `docToX()` return objects — enforces structural compatibility at call site |

The `docToEffectScores()` helper returns `undefined` if the nested object exists but contains no numeric values — preventing an empty `{}` from reaching the storefront.

---

## Storefront Data Flow

```
page.tsx (server component)
  → getProductBySlug(slug)         — full Product via Admin SDK
  → listProducts()                 — ProductSummary[] for related strip
  → ProductDetailClient (client)   — receives Product + ProductSummary[]
```

### Storefront section → data field mapping

| UI Section                         | Product Field(s)                                                    |
| ---------------------------------- | ------------------------------------------------------------------- |
| Hero — main image                  | `image` (fallback to first `images` entry)                          |
| Hero — thumbnail strip             | `images[]`                                                          |
| Hero — product name                | `name`                                                              |
| Hero — strain badge                | `strain`                                                            |
| Hero — THC pill                    | `labResults.thcPercent`                                             |
| Hero — effect pills                | `effects[]`                                                         |
| Hero — short description           | `description`                                                       |
| Hero — info table (Strain)         | `strain`                                                            |
| Hero — info table (THC)            | `labResults.thcPercent`                                             |
| Hero — info table (Terpenes)       | `labResults.terpenes[]`                                             |
| Hero — info table (Effects)        | `effects[]`                                                         |
| Hero — Available At                | `availableAt[]` → mapped to location names via `LOCATIONS` constant |
| Accordion: Description             | `details`                                                           |
| Accordion: What It Feels Like      | `whatToExpect[]` + `effectScores`                                   |
| Accordion: Terpene Profile         | `labResults.terpenes[]`                                             |
| Accordion: Cannabinoid Information | `labResults.{thcPercent, cbdPercent, testDate, labName}`            |
| Accordion: Flavor Profile          | `flavors[]`                                                         |
| Accordion: Lab Results / COA       | `coaUrl`                                                            |
| Related strip — image              | `ProductSummary.image`                                              |
| Related strip — strain badge       | `ProductSummary.strain`                                             |
| Related strip — name               | `ProductSummary.name`                                               |
| Related strip — category           | `ProductSummary.category`                                           |

All accordion sections are rendered only when their data is present (guard: `{field && <Accordion>...`). Missing data does not render an empty accordion — the section is simply absent.

---

## COA Field Lifecycle

### Storage convention

COA PDFs live under the `COA/` prefix in Firebase Storage:

```
gs://rush-n-relax.firebasestorage.app/COA/{filename}.pdf
```

### Admin — setting coaUrl

1. Admin opens the product create or edit form.
2. The `CoaSelector` component (`src/components/admin/CoaSelector/`) renders with three radio modes: None, Use Existing, Upload New.
3. **On page load:** zero Storage calls are made.
4. **Use Existing:** on first click, fires `fetchCoaDocuments` server action (`src/app/(admin)/admin/products/actions/fetchCoaDocuments.ts`), which calls `listCoaDocuments()` from the COA repository. Result is cached in component state — subsequent toggles re-use the cached list.
5. **Upload New:** uploads the PDF to `COA/{filename}` via `/api/admin/coa/upload`, auto-switches to Use Existing with the new file pre-selected.
6. **None:** clears `coaUrl` on save (hidden input value is `""`).
7. A hidden `<input name="coaUrl">` carries the selected URL into the parent form submission.
8. The `updateProduct` / `createProduct` server action reads `formData.get('coaUrl')` and passes it to `upsertProduct()`.

### Storefront — surfacing coaUrl

The product detail page renders the "Lab Results / COA" accordion section only when `product.coaUrl` is truthy. The section contains a link that opens the signed URL in a new tab.

---

## Repository Function Reference

| Function                         | Returns            | When to use                                           |
| -------------------------------- | ------------------ | ----------------------------------------------------- |
| `getProductBySlug(slug)`         | `Product \| null`  | Product detail page, admin edit form                  |
| `listProducts()`                 | `ProductSummary[]` | Storefront product listing (active only)              |
| `listAllProducts()`              | `ProductSummary[]` | Admin product list (all statuses)                     |
| `listProductsByIds(slugs)`       | `ProductSummary[]` | Inventory join — fetch product data for stocked slugs |
| `listProductsByCategory(cat)`    | `ProductSummary[]` | Category-filtered storefront pages                    |
| `upsertProduct(data)`            | `string` (slug)    | Create or update a product (merge semantics)          |
| `setProductStatus(slug, status)` | `void`             | Compliance/admin status changes                       |

---

## `ProductVariant` Interface

Defined in `src/types/product.ts`. Variants are authored at the product level and represent purchasable size/dose options (e.g. "1/8 oz", "10mg gummy"). Pricing is managed at the inventory level via `InventoryItem.variantPricing`.

| Field       | Type                                      | Required | Purpose                      |
| ----------- | ----------------------------------------- | -------- | ---------------------------- |
| `variantId` | `string`                                  | Yes      | Unique within the product    |
| `label`     | `string`                                  | Yes      | Display text, e.g. "1/8 oz"  |
| `weight`    | `{ value: number; unit: 'g' \| 'oz' }?`   | No       | Physical weight              |
| `quantity`  | `number?`                                 | No       | Unit count (e.g. 10 gummies) |
| `dose`      | `{ value: number; unit: 'mg' \| 'mcg' }?` | No       | Per-serving dose             |

`docToVariants()` maps the `variants` array defensively — entries missing `variantId` or `label` are silently skipped. Returns `undefined` (not `[]`) when no valid entries are found.

> Note: `src/constants/product-variants.ts` exports `CategoryVariant` (formerly `ProductVariant`), which represents UI-level display options for the storefront variant selector. These are separate from `ProductVariant` in `src/types/product.ts`.

---

## Online Inventory Location

Storefront pricing is read from the `inventory/online` virtual location (constant: `ONLINE_LOCATION_ID = 'online'`). This replaces the legacy hub-based `availableOnline` flag pattern for storefront purposes.

- `listOnlineAvailableInventory()` queries `inventory/online/items` filtered by `inStock = true`.
- Each item's `variantPricing` map drives the variant selector on the product detail page via `resolveVariantPricing()`.
- Firestore rules allow public reads from `inventory/online/items/{productId}`.
- Hub inventory (`inventory/hub`) is unaffected — still used for hub-specific features.
