# Products -- Engineering Reference

> Last updated: 2026-04-17

## NutritionFacts Interface (added 2026-04-16)

Defined in src/types/product.ts. Stored as a Firestore subdocument on edible products.

Fields: servingSize (string), servingsPerContainer (number), calories (number).
Optional: totalFat, sodium, totalCarbs, sugars, protein (all strings, e.g. "0g", "5mg").

The repository maps this via docToNutritionFacts() -- returns undefined if the subdocument is missing or lacks required fields.

## Storefront rendering

NutritionFactsPanel (src/components/NutritionFactsPanel/) renders an FDA-style black-bordered label.
Only mounted when product.nutritionFacts != null (category contract flag-gated at entry time).
Non-edible product pages are not affected.

## Admin entry — wizard UI (added 2026-04-17)

Product create and edit use a shared 6-step guided wizard:
`src/components/admin/ProductWizard/index.tsx`

Steps:

1. Vendor — select vendorSlug (required)
2. Category & Name — category, name, slug (auto-suggested from name on create)
3. Description — details, leaflyUrl, strain, effects, flavors
4. Lab Results — THC%, CBD%, terpenes, testDate, labName, COA upload
5. Availability & Compliance — availableAt checkboxes, federalDeadlineRisk toggle, status (edit only), variants
6. Images — featured + gallery via ProductImageUpload

Steps 3 (Cannabis Profile), 4 (COA), and 5 (Nutrition Facts) are conditionally shown based on
the selected category's `requiresCannabisProfile`, `requiresCOA`, and `requiresNutritionFacts`
flags (sourced from `ProductCategorySummary`). The edit page resolves `initialCategory` from
`listActiveCategories()` to pre-gate sections on load without requiring user re-selection.

The wizard renders all step content in the DOM at all times (hidden via CSS) so that
hidden inputs from TagInput / VariantEditor / CoaSelector are always present for FormData
submission via useActionState.

Per-step validation fires on Next button press before advancing.
Back navigation never loses data (all inputs are uncontrolled / default-value pinned).

Server actions are unchanged — the wizard maps directly to the same FormData fields.
The updateProduct action reads the category's `requiresNutritionFacts` flag to decide
whether to parse and persist NutritionFacts fields.

### createProduct (new/actions.ts)

Now also handles: vendorSlug, coaUrl, leaflyUrl (previously absent).

### ProductCreateForm (new/ProductCreateForm.tsx)

Thin wrapper that passes props + createProduct action to ProductWizardForm.
Page (new/page.tsx) now fetches vendors and locations alongside categories.

### ProductEditForm (edit/ProductEditForm.tsx)

Thin wrapper that passes props + updateProduct.bind(slug) to ProductWizardForm.
Status field (step 5) is visible only in edit mode. compliance-hold is read-only.
Page (edit/page.tsx) now fetches locations alongside other data.

## listProductsByVendor (added 2026-04-17)

New repository function in src/lib/repositories/product.repository.ts.

Queries active products where vendorSlug === the given vendor slug, ordered by name.
Used by the public vendor detail page (/vendors/[slug]) to show a vendor's product grid.
Exported from src/lib/repositories/index.ts.
