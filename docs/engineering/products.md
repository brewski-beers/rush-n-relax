# Products -- Engineering Reference

> Last updated: 2026-04-16

## NutritionFacts Interface (added 2026-04-16)

Defined in src/types/product.ts. Stored as a Firestore subdocument on edible products.

Fields: servingSize (string), servingsPerContainer (number), calories (number).
Optional: totalFat, sodium, totalCarbs, sugars, protein (all strings, e.g. "0g", "5mg").

The repository maps this via docToNutritionFacts() -- returns undefined if the subdocument is missing or lacks required fields.

## Storefront rendering

NutritionFactsPanel (src/components/NutritionFactsPanel/) renders an FDA-style black-bordered label.
Only mounted when product.category === 'edibles' AND product.nutritionFacts != null.
Non-edible product pages are not affected.

## Admin entry

ProductEditForm.tsx shows a Nutrition Facts fieldset in Step 5 when category === 'edibles'.
The updateProduct server action (edit/actions.ts) parses these fields and writes NutritionFacts
to Firestore only when servingSize, servingsPerContainer, and calories are all valid.
