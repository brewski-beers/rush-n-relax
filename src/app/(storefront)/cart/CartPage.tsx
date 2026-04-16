'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { formatCents } from '@/utils/currency';
import { LOCATIONS } from '@/constants/locations';

type FulfillmentType = 'pickup' | 'ship';

export default function CartPage() {
  const { items, removeItem, updateQty, subtotal, clearCart } = useCart();
  const [fulfillment, setFulfillment] = useState<FulfillmentType | null>(null);
  const [pickupLocation, setPickupLocation] = useState<string>('');

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
  const taxEstimate = Math.round(subtotal * TAX_RATE);

  return (
    <main className="cart-page">
      <div className="container">
        <h1>Your Cart</h1>

        <div className="cart-layout">
          {/* ── Cart Table ──────────────────────────────────────── */}
          <section
            className="cart-items-section cart-items-card"
            aria-label="Cart items"
          >
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
                  <tr key={`${item.productId}::${item.variantId}`}>
                    <td data-label="Product">
                      <span>{item.name}</span>
                      {item.variantLabel && (
                        <span className="cart-item-variant">
                          {' '}
                          — {item.variantLabel}
                        </span>
                      )}
                    </td>
                    <td data-label="Price">{formatCents(item.unitPrice)}</td>
                    <td data-label="Qty">
                      <div className="cart-qty-controls">
                        <button
                          type="button"
                          className="cart-qty-btn"
                          aria-label={`Decrease quantity of ${item.name}`}
                          onClick={() =>
                            updateQty(
                              item.productId,
                              item.variantId,
                              item.quantity - 1
                            )
                          }
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          className="cart-qty-btn"
                          aria-label={`Increase quantity of ${item.name}`}
                          onClick={() =>
                            updateQty(
                              item.productId,
                              item.variantId,
                              item.quantity + 1
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td data-label="Total">
                      {formatCents(item.unitPrice * item.quantity)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cart-remove-btn"
                        aria-label={`Remove ${item.name}`}
                        onClick={() =>
                          removeItem(item.productId, item.variantId)
                        }
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
                <dd>{formatCents(subtotal)}</dd>
              </div>
              <div className="cart-summary-row">
                <dt>Estimated Tax</dt>
                <dd>{formatCents(taxEstimate)}</dd>
              </div>
              <div className="cart-summary-row cart-summary-total">
                <dt>Estimated Total</dt>
                <dd>{formatCents(subtotal + taxEstimate)}</dd>
              </div>
            </dl>

            {/* Fulfillment Selector */}
            <fieldset className="cart-fulfillment">
              <legend>How would you like your order?</legend>
              <div className="cart-fulfillment-options">
                <button
                  type="button"
                  className={`cart-fulfillment-card${fulfillment === 'pickup' ? ' cart-fulfillment-card--active' : ''}`}
                  aria-pressed={fulfillment === 'pickup'}
                  onClick={() => setFulfillment('pickup')}
                >
                  <span className="cart-fulfillment-icon" aria-hidden="true">
                    🏪
                  </span>
                  <span className="cart-fulfillment-label">Pick Up</span>
                  <span className="cart-fulfillment-sub">In-store</span>
                </button>
                <button
                  type="button"
                  className={`cart-fulfillment-card${fulfillment === 'ship' ? ' cart-fulfillment-card--active' : ''}`}
                  aria-pressed={fulfillment === 'ship'}
                  onClick={() => setFulfillment('ship')}
                >
                  <span className="cart-fulfillment-icon" aria-hidden="true">
                    📦
                  </span>
                  <span className="cart-fulfillment-label">Ship to Me</span>
                  <span className="cart-fulfillment-sub">Delivery</span>
                </button>
              </div>
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
                  {LOCATIONS.map(loc => (
                    <option key={loc.slug} value={loc.slug}>
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
