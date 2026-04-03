'use client';

import { useState } from 'react';
import { computeMarkupPercent } from '@/utils/pricing';
import type { ProductPricing, PricingTier, WeightTier } from '@/types';

interface Props {
  initialPricing?: ProductPricing;
  isOwner: boolean;
  /** Category slug — used to determine whether tiered pricing grid is shown */
  category: string;
}

const WEIGHT_TIERS: WeightTier[] = [
  'gram',
  'eighth',
  'quarter',
  'half',
  'ounce',
];

const WEIGHT_TIER_LABELS: Record<WeightTier, string> = {
  gram: 'Gram',
  eighth: 'Eighth (3.5g)',
  quarter: 'Quarter (7g)',
  half: 'Half (14g)',
  ounce: 'Ounce (28g)',
};

const PRICING_TIERS: PricingTier[] = [
  'gram',
  'eighth',
  'quarter',
  'half',
  'ounce',
  'unit',
];

function centsToDisplay(cents: number | undefined): string {
  if (cents === undefined) return '';
  return (cents / 100).toFixed(2);
}

function parseDollars(value: string): number | undefined {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

const WEIGHT_BASED_CATEGORIES = ['flower', 'pre-roll'];

export function PricingFields({ initialPricing, isOwner, category }: Props) {
  const [price, setPrice] = useState(centsToDisplay(initialPricing?.price));
  const [cost, setCost] = useState(centsToDisplay(initialPricing?.cost));
  const [compareAtPrice, setCompareAtPrice] = useState(
    centsToDisplay(initialPricing?.compareAtPrice)
  );
  const [taxable, setTaxable] = useState(initialPricing?.taxable ?? true);
  const [pricingTier, setPricingTier] = useState<PricingTier>(
    initialPricing?.pricingTier ?? 'unit'
  );
  const [tieredPricing, setTieredPricing] = useState<
    Partial<Record<WeightTier, string>>
  >(
    WEIGHT_TIERS.reduce(
      (acc, t) => {
        acc[t] = centsToDisplay(initialPricing?.tieredPricing?.[t]);
        return acc;
      },
      {} as Partial<Record<WeightTier, string>>
    )
  );

  const markupDisplay = (() => {
    const priceCents = parseDollars(price);
    const costCents = parseDollars(cost);
    if (priceCents === undefined) return '—';
    const pct = computeMarkupPercent(costCents, priceCents);
    return pct !== undefined ? `${pct.toFixed(1)}%` : '—';
  })();

  const showTieredGrid =
    WEIGHT_BASED_CATEGORIES.includes(category) && pricingTier !== 'unit';

  // Compute hidden field values for form submission
  const priceCents = parseDollars(price);
  const costCents = parseDollars(cost);
  const compareAtCents = parseDollars(compareAtPrice);
  const markupPercent =
    priceCents !== undefined
      ? computeMarkupPercent(costCents, priceCents)
      : undefined;

  return (
    <fieldset className="admin-fieldset">
      <legend>Pricing</legend>

      {/* Hidden cents values for server action */}
      {priceCents !== undefined && (
        <input type="hidden" name="pricingPrice" value={priceCents} />
      )}
      {isOwner && costCents !== undefined && (
        <input type="hidden" name="pricingCost" value={costCents} />
      )}
      {compareAtCents !== undefined && (
        <input
          type="hidden"
          name="pricingCompareAtPrice"
          value={compareAtCents}
        />
      )}
      {markupPercent !== undefined && (
        <input
          type="hidden"
          name="pricingMarkupPercent"
          value={markupPercent}
        />
      )}
      <input
        type="hidden"
        name="pricingTaxable"
        value={taxable ? 'true' : 'false'}
      />
      <input type="hidden" name="pricingTier" value={pricingTier} />
      {showTieredGrid &&
        WEIGHT_TIERS.map(t => {
          const cents = parseDollars(tieredPricing[t] ?? '');
          return cents !== undefined ? (
            <input
              key={t}
              type="hidden"
              name={`pricingTiered_${t}`}
              value={cents}
            />
          ) : null;
        })}

      <label>
        Retail Price ($){' '}
        <span className="admin-hint">
          Required before product can be set to active
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={price}
          onChange={e => setPrice(e.target.value)}
        />
      </label>

      {isOwner && (
        <label>
          Cost ($){' '}
          <span className="admin-hint">(wholesale / COGS — owner only)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={cost}
            onChange={e => setCost(e.target.value)}
          />
        </label>
      )}

      {isOwner && (
        <div className="admin-hint" aria-live="polite">
          Markup: {markupDisplay}
        </div>
      )}

      <label>
        Compare-At Price ($){' '}
        <span className="admin-hint">(optional — shown as strikethrough)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={compareAtPrice}
          onChange={e => setCompareAtPrice(e.target.value)}
        />
      </label>

      <label>
        Pricing Tier
        <select
          value={pricingTier}
          onChange={e => setPricingTier(e.target.value as PricingTier)}
        >
          {PRICING_TIERS.map(t => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </label>

      {showTieredGrid && (
        <fieldset className="admin-fieldset">
          <legend>Tiered Pricing</legend>
          {WEIGHT_TIERS.map(t => (
            <label key={t}>
              {WEIGHT_TIER_LABELS[t]} ($)
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={tieredPricing[t] ?? ''}
                onChange={e =>
                  setTieredPricing(prev => ({ ...prev, [t]: e.target.value }))
                }
              />
            </label>
          ))}
        </fieldset>
      )}

      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={taxable}
          onChange={e => setTaxable(e.target.checked)}
        />
        Taxable
      </label>
    </fieldset>
  );
}
