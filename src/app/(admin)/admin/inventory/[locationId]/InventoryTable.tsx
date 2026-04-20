'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateInventoryItem, updateVariantPricing } from './actions';
import type { ProductSummary, ProductVariant } from '@/types';
import type { InventoryItem } from '@/types/inventory';

const QTY_ZERO_TOAST =
  'Set qty above 0 to re-enable online availability.';

export interface InventoryRow extends ProductSummary {
  quantity: number;
  inStock: boolean;
  availableOnline: boolean;
  availablePickup: boolean;
  featured: boolean;
  variantPricing?: InventoryItem['variantPricing'];
  /** Product variants — for variant pricing panel */
  variants?: ProductVariant[];
}

interface Props {
  rows: InventoryRow[];
  locationId: string;
  isOnline: boolean;
}

export default function InventoryTable({ rows, locationId, isOnline }: Props) {
  // online: 6 cols (Product, Category, Qty, In Stock, Featured, Variant Pricing)
  // retail: 5 cols (Product, Category, Qty, In Stock, Available Pickup)
  const colSpan = isOnline ? 6 : 5;

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th className="admin-col-qty">Quantity</th>
            <th className="admin-col-toggle">In Stock</th>
            {!isOnline && (
              <th className="admin-col-toggle">Available Pickup</th>
            )}
            {isOnline && <th className="admin-col-toggle">Featured</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <InventoryRow
              key={`${row.id}:${row.quantity}:${row.inStock}:${row.availableOnline}:${row.featured}`}
              row={row}
              locationId={locationId}
              isOnline={isOnline}
            />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="admin-empty">
                No products found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function InventoryRow({
  row,
  locationId,
  isOnline,
}: {
  row: InventoryRow;
  locationId: string;
  isOnline: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [quantityInput, setQuantityInput] = useState(String(row.quantity));
  const [availableOnline, setAvailableOnline] = useState(row.availableOnline);
  const [availablePickup, setAvailablePickup] = useState(row.availablePickup);
  const [featured, setFeatured] = useState(row.featured);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  const quantity = normalizeQuantityInput(quantityInput);
  const inStock = quantity > 0;
  const featuredEnabled = inStock;

  function triggerSuccess() {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 1500);
  }

  function handleToggle(
    field: 'inStock' | 'availableOnline' | 'availablePickup' | 'featured',
    value: boolean
  ) {
    setUpdateError(null);
    const previous = {
      quantityInput,
      availableOnline,
      availablePickup,
      featured,
    };
    const inStockCascaded = field === 'inStock' && !value;

    if (field === 'inStock') {
      const nextQuantity = value ? Math.max(quantity, 1) : 0;
      setQuantityInput(String(nextQuantity));
      if (!value) {
        setAvailableOnline(false);
        setAvailablePickup(false);
        setFeatured(false);
      }
    } else if (field === 'availableOnline') {
      setAvailableOnline(value);
      if (!value) setFeatured(false);
    } else if (field === 'availablePickup') {
      setAvailablePickup(value);
    } else {
      setFeatured(value);
    }

    const nextPatch: {
      inStock?: boolean;
      quantity?: number;
      availableOnline?: boolean;
      availablePickup?: boolean;
      featured?: boolean;
    } =
      field === 'inStock'
        ? {
            quantity: value ? Math.max(quantity, 1) : 0,
            ...(value
              ? {}
              : {
                  availableOnline: false,
                  availablePickup: false,
                  featured: false,
                }),
          }
        : field === 'availableOnline'
          ? { availableOnline: value, ...(!value ? { featured: false } : {}) }
          : field === 'availablePickup'
            ? { availablePickup: value }
            : { featured: value };

    startTransition(async () => {
      try {
        const result = await updateInventoryItem(
          locationId,
          row.id,
          nextPatch
        );
        setUpdateError(null);
        if (result.blocked?.availableOnline || result.blocked?.availablePickup) {
          // Cascade enforcement: quantity=0 silently forces availability false.
          // Surface an inline toast so staff understand why the toggle didn't stick.
          // Do NOT auto-restore the flags — the server is the source of truth.
          setBlockedMessage(QTY_ZERO_TOAST);
          setAvailableOnline(false);
          setAvailablePickup(false);
          setTimeout(() => setBlockedMessage(null), 4000);
        } else if (inStockCascaded) {
          // inStock toggled off -> qty forced to 0, availability cleared.
          // Surface inline toast so staff understand the cascade.
          setBlockedMessage(QTY_ZERO_TOAST);
          setTimeout(() => setBlockedMessage(null), 4000);
        } else {
          setBlockedMessage(null);
          triggerSuccess();
        }
        router.refresh();
      } catch {
        setQuantityInput(previous.quantityInput);
        setAvailableOnline(previous.availableOnline);
        setAvailablePickup(previous.availablePickup);
        setFeatured(previous.featured);
        setUpdateError('Failed to update. Please try again.');
      }
    });
  }

  function handleQuantityInput(value: string) {
    if (/^\d*$/.test(value)) {
      setQuantityInput(value);
      if (normalizeQuantityInput(value) === 0) {
        setAvailableOnline(false);
        setFeatured(false);
      }
    }
  }

  function commitQuantity() {
    setUpdateError(null);
    const previous = { quantityInput, availableOnline, featured };
    const nextQuantity = normalizeQuantityInput(quantityInput);
    const nextAvailableOnline = nextQuantity > 0 ? availableOnline : false;
    const nextFeatured = nextQuantity > 0 ? featured : false;
    const cascadeCleared =
      nextQuantity === 0 &&
      (row.availableOnline || row.availablePickup || row.featured);

    setQuantityInput(String(nextQuantity));
    setAvailableOnline(nextAvailableOnline);
    setFeatured(nextFeatured);

    startTransition(async () => {
      try {
        await updateInventoryItem(locationId, row.id, {
          quantity: nextQuantity,
          ...(nextAvailableOnline !== availableOnline
            ? { availableOnline: nextAvailableOnline }
            : {}),
          ...(nextFeatured !== featured ? { featured: nextFeatured } : {}),
        });
        setUpdateError(null);
        if (cascadeCleared) {
          setBlockedMessage(QTY_ZERO_TOAST);
          setTimeout(() => setBlockedMessage(null), 4000);
        } else {
          triggerSuccess();
        }
        router.refresh();
      } catch {
        setQuantityInput(previous.quantityInput);
        setAvailableOnline(previous.availableOnline);
        setFeatured(previous.featured);
        setUpdateError('Failed to update. Please try again.');
      }
    });
  }

  return (
    <>
      <tr className={isPending ? 'admin-row-pending' : undefined}>
        <td>{row.name}</td>
        <td>{row.category}</td>
        <td className="admin-qty-cell">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="admin-qty-input"
            value={quantityInput}
            disabled={isPending}
            onChange={e => handleQuantityInput(e.target.value)}
            onBlur={commitQuantity}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitQuantity();
              }
            }}
            aria-label={`Quantity for ${row.name}`}
          />
        </td>
        <td className="admin-col-toggle">
          <span className="admin-toggle-cell">
            <input
              type="checkbox"
              className="admin-toggle"
              checked={inStock}
              disabled={isPending}
              onChange={e => handleToggle('inStock', e.target.checked)}
              aria-label={`In stock for ${row.name}`}
            />
            {updateError && (
              <span className="admin-inline-error">{updateError}</span>
            )}
            {blockedMessage && (
              <span
                className="admin-inline-toast"
                role="status"
                aria-live="polite"
              >
                {blockedMessage}
              </span>
            )}
            <span
              className={
                showSuccess
                  ? 'admin-toggle-success admin-toggle-success--visible'
                  : 'admin-toggle-success'
              }
              aria-hidden="true"
            >
              ✓
            </span>
          </span>
        </td>
        {!isOnline && (
          <td className="admin-col-toggle">
            <input
              type="checkbox"
              className="admin-toggle"
              checked={availablePickup}
              disabled={isPending || !inStock}
              onChange={e => handleToggle('availablePickup', e.target.checked)}
              aria-label={`Available pickup for ${row.name}`}
            />
          </td>
        )}
        {isOnline && (
          <td className="admin-col-toggle">
            <input
              type="checkbox"
              className="admin-toggle"
              checked={featured}
              disabled={isPending || !featuredEnabled}
              onChange={e => handleToggle('featured', e.target.checked)}
              aria-label={`Featured for ${row.name}`}
            />
          </td>
        )}
      </tr>
      {showPricing && row.variants && row.variants.length > 0 && (
        <tr className="variant-pricing-panel-row">
          <td colSpan={6}>
            <VariantPricingPanel
              productId={row.id}
              locationId={locationId}
              variants={row.variants}
              variantPricing={row.variantPricing}
              onSaved={() => router.refresh()}
            />
          </td>
        </tr>
      )}
      {row.variants && row.variants.length > 0 && (
        <tr className="variant-pricing-toggle-row">
          <td colSpan={6} className="variant-pricing-toggle-cell">
            <button
              type="button"
              className="admin-link-btn"
              onClick={() => setShowPricing(p => !p)}
            >
              {showPricing ? 'Hide Pricing' : 'Set Variant Pricing'}
            </button>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Variant Pricing Panel ─────────────────────────────────────────────────

interface VariantPricingPanelProps {
  productId: string;
  locationId: string;
  variants: ProductVariant[];
  variantPricing?: InventoryItem['variantPricing'];
  onSaved: () => void;
}

function VariantPricingPanel({
  productId,
  locationId,
  variants,
  variantPricing,
  onSaved,
}: VariantPricingPanelProps) {
  // Local state: dollars.cents string for each variant
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(
      variants.map(v => [
        v.variantId,
        variantPricing?.[v.variantId]?.price !== undefined
          ? (variantPricing[v.variantId].price / 100).toFixed(2)
          : '',
      ])
    )
  );
  const [compareAtPrices, setCompareAtPrices] = useState<
    Record<string, string>
  >(
    Object.fromEntries(
      variants.map(v => [
        v.variantId,
        variantPricing?.[v.variantId]?.compareAtPrice !== undefined
          ? (variantPricing[v.variantId].compareAtPrice! / 100).toFixed(2)
          : '',
      ])
    )
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const newPricing: NonNullable<InventoryItem['variantPricing']> = {};
      for (const v of variants) {
        const rawPrice = prices[v.variantId]?.trim();
        if (!rawPrice) continue; // empty = no price set — exclude from storefront
        const priceCents = Math.round(parseFloat(rawPrice) * 100);
        if (!Number.isFinite(priceCents) || priceCents < 0) continue;
        const rawCompare = compareAtPrices[v.variantId]?.trim();
        const compareCents =
          rawCompare && rawCompare !== ''
            ? Math.round(parseFloat(rawCompare) * 100)
            : undefined;
        newPricing[v.variantId] = {
          price: priceCents,
          ...(compareCents !== undefined && compareCents > 0
            ? { compareAtPrice: compareCents }
            : {}),
        };
      }
      await updateVariantPricing(locationId, productId, newPricing);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);
      onSaved();
    } catch {
      setSaveError('Failed to save pricing. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="variant-pricing-panel">
      <h4 className="variant-pricing-panel-title">Variant Pricing</h4>
      <span className="admin-hint">
        Enter price in dollars (e.g. 28.00). Leave blank to hide variant from
        storefront. Compare-at is the original price shown as strikethrough.
      </span>
      <table className="variant-pricing-table">
        <thead>
          <tr>
            <th>Variant</th>
            <th>Price ($)</th>
            <th>Compare-at ($)</th>
          </tr>
        </thead>
        <tbody>
          {variants.map(v => (
            <tr key={v.variantId}>
              <td>{v.label}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="admin-price-input"
                  value={prices[v.variantId] ?? ''}
                  onChange={e =>
                    setPrices(prev => ({
                      ...prev,
                      [v.variantId]: e.target.value,
                    }))
                  }
                  placeholder="e.g. 28.00"
                  aria-label={`Price for ${v.label}`}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="admin-price-input"
                  value={compareAtPrices[v.variantId] ?? ''}
                  onChange={e =>
                    setCompareAtPrices(prev => ({
                      ...prev,
                      [v.variantId]: e.target.value,
                    }))
                  }
                  placeholder="optional"
                  aria-label={`Compare-at price for ${v.label}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="variant-pricing-panel-actions">
        {saveError && <span className="admin-inline-error">{saveError}</span>}
        {saveSuccess && (
          <span className="admin-toggle-success admin-toggle-success--visible">
            Saved ✓
          </span>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            void handleSave();
          }}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Pricing'}
        </button>
      </div>
    </div>
  );
}

function normalizeQuantityInput(value: string): number {
  if (!value.trim()) return 0;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, parsed);
}
