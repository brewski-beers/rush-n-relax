'use client';

/**
 * NutritionFactsFields — form inputs for the NutritionFacts subdocument.
 * Used inside ProductWizardForm (step 5) when the selected category has
 * requiresNutritionFacts: true.
 *
 * Field names match what the product create/edit server actions expect:
 *   nfServingSize, nfServingsPerContainer, nfCalories,
 *   nfTotalFat, nfSodium, nfTotalCarbs, nfSugars, nfProtein
 */

import type { NutritionFacts } from '@/types';

interface Props {
  nutritionFacts?: NutritionFacts;
}

export function NutritionFactsFields({ nutritionFacts }: Props) {
  return (
    <>
      <label>
        Serving Size <span className="admin-hint">(e.g. &ldquo;1 gummy (5g)&rdquo;)</span>
        <input
          name="nfServingSize"
          type="text"
          defaultValue={nutritionFacts?.servingSize ?? ''}
          placeholder="e.g. 1 gummy (5g)"
        />
      </label>

      <label>
        Servings Per Container
        <input
          name="nfServingsPerContainer"
          type="number"
          min="1"
          step="1"
          defaultValue={nutritionFacts?.servingsPerContainer ?? ''}
        />
      </label>

      <label>
        Calories
        <input
          name="nfCalories"
          type="number"
          min="0"
          step="1"
          defaultValue={nutritionFacts?.calories ?? ''}
        />
      </label>

      <label>
        Total Fat <span className="admin-hint">(optional, e.g. &ldquo;0g&rdquo;)</span>
        <input
          name="nfTotalFat"
          type="text"
          defaultValue={nutritionFacts?.totalFat ?? ''}
          placeholder="0g"
        />
      </label>

      <label>
        Sodium <span className="admin-hint">(optional, e.g. &ldquo;5mg&rdquo;)</span>
        <input
          name="nfSodium"
          type="text"
          defaultValue={nutritionFacts?.sodium ?? ''}
          placeholder="5mg"
        />
      </label>

      <label>
        Total Carbohydrates <span className="admin-hint">(optional, e.g. &ldquo;15g&rdquo;)</span>
        <input
          name="nfTotalCarbs"
          type="text"
          defaultValue={nutritionFacts?.totalCarbs ?? ''}
          placeholder="15g"
        />
      </label>

      <label>
        Sugars <span className="admin-hint">(optional, e.g. &ldquo;10g&rdquo;)</span>
        <input
          name="nfSugars"
          type="text"
          defaultValue={nutritionFacts?.sugars ?? ''}
          placeholder="10g"
        />
      </label>

      <label>
        Protein <span className="admin-hint">(optional, e.g. &ldquo;1g&rdquo;)</span>
        <input
          name="nfProtein"
          type="text"
          defaultValue={nutritionFacts?.protein ?? ''}
          placeholder="1g"
        />
      </label>
    </>
  );
}
