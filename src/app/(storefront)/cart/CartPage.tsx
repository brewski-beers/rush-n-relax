'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { formatCents } from '@/utils/currency';

type FulfillmentType = 'pickup' | 'ship';

const PICKUP_LOCATIONS = [
  { id: 'oak-ridge', name: 'Oak Ridge' },
  { id: 'maryville', name: 'Maryville' },
  { id: 'seymour', name: 'Seymour' },
] as const;

export default function CartPage() {
  const { items, removeItem, updateQty, total, clearCart } = useCart();
  const [fulfillment, setFulfillment] = useState<FulfillmentType | null>(null);
  const [pickupLocation, setPickupLocation] = useState<string>('');

  const hasOnlineItems = items.some(
    // Items were added from products with availableOnline pricing — we allow shipping CTA
    () => true
  );

  const canCheckout =
    fulfillment === 'ship' ||
    (fulfillment === 'pickup' && pickupLocation !== '');

  if (items.length === 0) {
    return (
      <main className="cart-page">
        <div className="container">
          <h1>Your Cart</h1>
          <div className="cart-empty">
            <p>Your cart is empty.</p>
            <Link href="/products" className="btn btn-primary">
              Browse Products
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Tax placeholder — real computation is server-side at checkout
  const TAX_RATE = 0.0925;
  const taxEstimate = Math.round(total * TAX_RATE);

  return (
    <main className="cart-page">
      <div className="container">
        <h1>Your Cart</h1>

        <div className="cart-layout">
          {/* ── Cart Table ──────────────────────────────────────── */}
          <section className="cart-items-section" aria-label="Cart items">
            <table className="cart-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th>
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.productId}>
                    <td>
                      <Link href={`/products/${item.productSlug}`}>
                        {item.productName}
                      </Link>
                    </td>
                    <td>{formatCents(item.unitPrice)}</td>
                    <td>
                      <div className="cart-qty-controls">
                        <button
                          type="button"
                          className="cart-qty-btn"
                          aria-label={`Decrease quantity of ${item.productName}`}
                          onClick={() =>
                            item.quantity === 1
                              ? removeItem(item.productId)
                              : updateQty(item.productId, item.quantity - 1)
                          }
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          className="cart-qty-btn"
                          aria-label={`Increase quantity of ${item.productName}`}
                          onClick={() =>
                            updateQty(item.productId, item.quantity + 1)
                          }
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td>{formatCents(item.unitPrice * item.quantity)}</td>
                    <td>
                      <button
                        type="button"
                        className="cart-remove-btn"
                        aria-label={`Remove ${item.productName}`}
                        onClick={() => removeItem(item.productId)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ── Order Summary + Fulfillment ──────────────────────── */}
          <aside className="cart-summary">
            <h2>Order Summary</h2>
            <dl className="cart-summary-lines">
              <div className="cart-summary-row">
                <dt>Subtotal</dt>
                <dd>{formatCents(total)}</dd>
              </div>
              <div className="cart-summary-row">
                <dt>Estimated Tax</dt>
                <dd>{formatCents(taxEstimate)}</dd>
              </div>
              <div className="cart-summary-row cart-summary-total">
                <dt>Estimated Total</dt>
                <dd>{formatCents(total + taxEstimate)}</dd>
              </div>
            </dl>

            {/* Fulfillment Selector */}
            <fieldset className="cart-fulfillment">
              <legend>How would you like your order?</legend>
              <label className="cart-fulfillment-option">
                <input
                  type="radio"
                  name="fulfillment"
                  value="pickup"
                  checked={fulfillment === 'pickup'}
                  onChange={() => setFulfillment('pickup')}
                />
                Pickup
              </label>
              {hasOnlineItems && (
                <label className="cart-fulfillment-option">
                  <input
                    type="radio"
                    name="fulfillment"
                    value="ship"
                    checked={fulfillment === 'ship'}
                    onChange={() => setFulfillment('ship')}
                  />
                  Ship to me
                </label>
              )}
            </fieldset>

            {fulfillment === 'pickup' && (
              <div className="cart-pickup-location">
                <label htmlFor="pickup-location">Select location</label>
                <select
                  id="pickup-location"
                  value={pickupLocation}
                  onChange={e => setPickupLocation(e.target.value)}
                >
                  <option value="">— Choose a location —</option>
                  {PICKUP_LOCATIONS.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary cart-checkout-btn"
              disabled={!canCheckout}
              aria-disabled={!canCheckout}
            >
              Proceed to Checkout
            </button>

            <button
              type="button"
              className="cart-clear-btn"
              onClick={clearCart}
            >
              Clear cart
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}
