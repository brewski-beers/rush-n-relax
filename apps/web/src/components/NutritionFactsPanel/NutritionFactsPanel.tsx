import type { NutritionFacts } from '@/types';
import styles from './NutritionFactsPanel.module.css';

interface Props {
  facts: NutritionFacts;
}

/**
 * FDA-style Nutrition Facts label for edible products.
 * Rendered on the product detail page only when:
 *   - product.category === 'edibles'
 *   - product.nutritionFacts != null
 */
export function NutritionFactsPanel({ facts }: Props) {
  return (
    <div className={styles.panel} aria-label="Nutrition Facts">
      <div className={styles.header}>Nutrition Facts</div>
      <div className={styles.servingInfo}>
        <div className={styles.servingsPerContainer}>
          {facts.servingsPerContainer} serving
          {facts.servingsPerContainer !== 1 ? 's' : ''} per container
        </div>
        <div className={styles.servingSize}>
          <span>Serving size</span>
          <span>{facts.servingSize}</span>
        </div>
      </div>
      <div className={styles.caloriesBlock}>
        <span className={styles.caloriesLabel}>Calories</span>
        <span className={styles.caloriesValue}>{facts.calories}</span>
      </div>
      <div className={styles.dvNote}>% Daily Value*</div>
      {facts.totalFat !== undefined && (
        <div className={styles.row}>
          <span>
            <strong>Total Fat</strong> {facts.totalFat}
          </span>
        </div>
      )}
      {facts.sodium !== undefined && (
        <div className={styles.row}>
          <span>
            <strong>Sodium</strong> {facts.sodium}
          </span>
        </div>
      )}
      {facts.totalCarbs !== undefined && (
        <div className={styles.row}>
          <span>
            <strong>Total Carbohydrate</strong> {facts.totalCarbs}
          </span>
        </div>
      )}
      {facts.sugars !== undefined && (
        <div className={`${styles.row} ${styles.rowIndent}`}>
          <span>
            <em>Includes {facts.sugars} Added Sugars</em>
          </span>
        </div>
      )}
      {facts.protein !== undefined && (
        <div className={styles.row}>
          <span>
            <strong>Protein</strong> {facts.protein}
          </span>
        </div>
      )}
      <div className={styles.footnote}>
        * The % Daily Value (DV) tells you how much a nutrient in a serving of
        food contributes to a daily diet. 2,000 calories a day is used for
        general nutrition advice.
      </div>
    </div>
  );
}
