'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { formatCents } from '@/utils/currency';
import { LOCATIONS } from '@/constants/locations';

type FulfillmentType = 'pickup' | 'ship';

interface LocationAvailability {
  available: boolean;
  unavailableItems: string[];
}

interface AvailabilityResult {
  locations: Record<string, LocationAvailability>;
}

// Retail-only slugs from LOCATIONS (excludes hub/online virtuals)
const RETAIL_LOCATION_SLUGS = new Set(LOCATIONS.map(l => l.slug));

export default function CartPage() {
  const { items, removeItem, updateQty, subtotal, clearCart } = useCart();
  const [fulfillment, setFulfillment] = useState<FulfillmentType | null>(null);
  const [pickupLocation, setPickupLocation] = useState<string>('');

  // Pickup availability state
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityResult | null>(
    null
  );
  const [availabilityError, setAvailabilityError] = useState(false);

  // Eligible pickup locations — those where all items are available
  const eligibleLocations = LOCATIONS.filter(
    loc =>
      RETAIL_LOCATION_SLUGS.has(loc.slug) &&
      availability?.locations[loc.slug]?.available === true
  );

  const checkAvailability = useCallback(async () => {
    setAvailabilityLoading(true);
    setAvailabilityError(false);
    setAvailability(null);
    setPickupLocation('');
    try {
      const payload = items.map(i => ({
        productId: i.productId,
        variantId: i.variantId,
      }));
      const res = await fetch(
        `/api/cart/availability?items=${encodeURIComponent(JSON.stringify(payload))}`
      );
      if (!res.ok) throw new Error('Availability check failed');
      const data = (await res.json()) as AvailabilityResult; // external API response, safe cast
      setAvailability(data);
    } catch {
      setAvailabilityError(true);
    } finally {
      setAvailabilityLoading(false);
    }
  }, [items]);

  // Fetch availability whenever user selects pickup
  useEffect(() => {
    if (fulfillment === 'pickup') {
      void checkAvailability();
    }
  }, [fulfillment, checkAvailability]);

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
          {/* ── Cart Items ──────────────────────────────────────── */}
          <section
            className="cart-items-section cart-items-card"
            aria-label="Cart items"
          >
            <ul className="cart-item-list">
              {items.map(item => (
                <li
                  key={`${item.productId}::${item.variantId}`}
                  className="cart-item"
                >
                  {/* Thumbnail */}
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="cart-item-image"
                    />
                  )}

                  {/* Details — name + variant + unit price */}
                  <div className="cart-item-details">
                    <p className="cart-item-name">{item.name}</p>
                    {item.variantLabel && (
                      <p className="cart-item-variant">{item.variantLabel}</p>
                    )}
                    <p className="cart-item-unit-price">
                      {formatCents(item.unitPrice)} each
                    </p>
                  </div>

                  {/* Right column — line total + stepper */}
                  <div className="cart-item-right">
                    <p className="cart-item-total">
                      {formatCents(item.unitPrice * item.quantity)}
                    </p>
                    <div className="cart-qty-controls">
                      <button
                        type="button"
                        className={`cart-qty-btn${item.quantity === 1 ? ' cart-qty-btn--remove' : ''}`}
                        aria-label={
                          item.quantity === 1
                            ? `Remove ${item.name}`
                            : `Decrease quantity of ${item.name}`
                        }
                        onClick={() =>
                          item.quantity === 1
                            ? removeItem(item.productId, item.variantId)
                            : updateQty(
                                item.productId,
                                item.variantId,
                                item.quantity - 1
                              )
                        }
                      >
                        {item.quantity === 1 ? '✕' : '−'}
                      </button>
                      <span className="cart-item-qty">{item.quantity}</span>
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
                  </div>
                </li>
              ))}
            </ul>
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

            {/* Pickup location section */}
            {fulfillment === 'pickup' && (
              <div className="cart-pickup-location">
                {availabilityLoading && (
                  <p className="cart-pickup-status">Checking availability…</p>
                )}

                {!availabilityLoading && availabilityError && (
                  <p className="cart-pickup-status cart-pickup-status--error">
                    Couldn&apos;t check availability.{' '}
                    <button
                      type="button"
                      className="cart-pickup-retry"
                      onClick={() => void checkAvailability()}
                    >
                      Try again
                    </button>
                  </p>
                )}

                {!availabilityLoading && availability && (
                  <>
                    {eligibleLocations.length === 0 ? (
                      <p className="cart-pickup-status cart-pickup-status--unavailable">
                        Your cart items aren&apos;t available for pickup at any
                        location right now. Choose shipping or{' '}
                        <Link href="/locations">visit us in store</Link>.
                      </p>
                    ) : (
                      <>
                        <label htmlFor="pickup-location">Select location</label>
                        <select
                          id="pickup-location"
                          value={pickupLocation}
                          onChange={e => setPickupLocation(e.target.value)}
                        >
                          <option value="">— Choose a location —</option>
                          {eligibleLocations.map(loc => (
                            <option key={loc.slug} value={loc.slug}>
                              {loc.name}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </>
                )}
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
