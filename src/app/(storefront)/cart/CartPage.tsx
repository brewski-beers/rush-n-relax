'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { formatCents } from '@/utils/currency';
import { LOCATIONS } from '@/constants/locations';
import {
  AgeCheckerModal,
  type AgeCheckOutcome,
} from '@/components/AgeCheckerModal/AgeCheckerModal';
import { SHIPPING_STATES, canShipToState } from '@/constants/shipping';
import type { ShippingAddress } from '@/types';

type FulfillmentType = 'pickup' | 'shipping';

interface LocationAvailability {
  available: boolean;
  unavailableItems: string[];
}

interface AvailabilityResult {
  locations: Record<string, LocationAvailability>;
}

const RETAIL_LOCATION_SLUGS = new Set(LOCATIONS.map(l => l.slug));

const EMPTY_ADDRESS: ShippingAddress = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  zip: '',
};

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQty, subtotal, clearCart } = useCart();
  const [fulfillment, setFulfillment] = useState<FulfillmentType | null>(null);
  const [pickupLocation, setPickupLocation] = useState<string>('');
  const [shippingAddress, setShippingAddress] =
    useState<ShippingAddress>(EMPTY_ADDRESS);
  const [email, setEmail] = useState('');

  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityResult | null>(
    null
  );
  const [availabilityError, setAvailabilityError] = useState(false);

  const [ageCheckOpen, setAgeCheckOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

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
      const data = (await res.json()) as AvailabilityResult;
      setAvailability(data);
    } catch {
      setAvailabilityError(true);
    } finally {
      setAvailabilityLoading(false);
    }
  }, [items]);

  useEffect(() => {
    if (fulfillment === 'pickup') {
      void checkAvailability();
    }
  }, [fulfillment, checkAvailability]);

  const shippingStateAllowed =
    fulfillment !== 'shipping' ||
    (shippingAddress.state !== '' && canShipToState(shippingAddress.state));

  const shippingAddressComplete =
    fulfillment !== 'shipping' ||
    (shippingAddress.name &&
      shippingAddress.line1 &&
      shippingAddress.city &&
      shippingAddress.state &&
      shippingAddress.zip);

  const canCheckout =
    (fulfillment === 'pickup' && pickupLocation !== '') ||
    (fulfillment === 'shipping' &&
      shippingStateAllowed &&
      shippingAddressComplete);

  const TAX_RATE = 0.0925;
  const taxEstimate = Math.round(subtotal * TAX_RATE);
  const total = subtotal + taxEstimate;

  function startCheckout() {
    setCheckoutError(null);
    setAgeCheckOpen(true);
  }

  const handleAgeResult = useCallback(
    async (result: AgeCheckOutcome) => {
      setAgeCheckOpen(false);
      if (result.status === 'deny') {
        setCheckoutError(result.reason || 'ID verification failed.');
        return;
      }

      setCheckoutLoading(true);
      try {
        const locationId = fulfillment === 'pickup' ? pickupLocation : 'online';
        const orderItems = items.map(i => ({
          productId: i.productId,
          productName: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.unitPrice * i.quantity,
        }));

        const res = await fetch('/api/checkout/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            items: orderItems,
            subtotal,
            tax: taxEstimate,
            total,
            locationId,
            fulfillmentType: fulfillment,
            ageVerificationId: result.verificationId,
            customerEmail: email || undefined,
            shippingAddress:
              fulfillment === 'shipping' ? shippingAddress : undefined,
          }),
        });
        const data = (await res.json()) as {
          redirectUrl?: string;
          error?: string;
        };
        if (!res.ok || !data.redirectUrl) {
          setCheckoutError(data.error ?? 'Checkout failed.');
          return;
        }
        clearCart();
        router.push(data.redirectUrl);
      } catch {
        setCheckoutError('Network error. Please try again.');
      } finally {
        setCheckoutLoading(false);
      }
    },
    [
      fulfillment,
      pickupLocation,
      items,
      subtotal,
      taxEstimate,
      total,
      shippingAddress,
      email,
      clearCart,
      router,
    ]
  );

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

  return (
    <main className="cart-page">
      <div className="container">
        <h1>Your Cart</h1>

        <div className="cart-layout">
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
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="cart-item-image"
                    />
                  )}

                  <div className="cart-item-details">
                    <p className="cart-item-name">{item.name}</p>
                    {item.variantLabel && (
                      <p className="cart-item-variant">{item.variantLabel}</p>
                    )}
                    <p className="cart-item-unit-price">
                      {formatCents(item.unitPrice)} each
                    </p>
                  </div>

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
                <dd>{formatCents(total)}</dd>
              </div>
            </dl>

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
                  className={`cart-fulfillment-card${fulfillment === 'shipping' ? ' cart-fulfillment-card--active' : ''}`}
                  aria-pressed={fulfillment === 'shipping'}
                  onClick={() => setFulfillment('shipping')}
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

            {fulfillment === 'shipping' && (
              <div className="cart-shipping-form">
                <label htmlFor="ship-name">Full name</label>
                <input
                  id="ship-name"
                  value={shippingAddress.name}
                  onChange={e =>
                    setShippingAddress({
                      ...shippingAddress,
                      name: e.target.value,
                    })
                  }
                />
                <label htmlFor="ship-line1">Street address</label>
                <input
                  id="ship-line1"
                  value={shippingAddress.line1}
                  onChange={e =>
                    setShippingAddress({
                      ...shippingAddress,
                      line1: e.target.value,
                    })
                  }
                />
                <label htmlFor="ship-line2">Apt / Suite (optional)</label>
                <input
                  id="ship-line2"
                  value={shippingAddress.line2 ?? ''}
                  onChange={e =>
                    setShippingAddress({
                      ...shippingAddress,
                      line2: e.target.value,
                    })
                  }
                />
                <label htmlFor="ship-city">City</label>
                <input
                  id="ship-city"
                  value={shippingAddress.city}
                  onChange={e =>
                    setShippingAddress({
                      ...shippingAddress,
                      city: e.target.value,
                    })
                  }
                />
                <label htmlFor="ship-state">State</label>
                <select
                  id="ship-state"
                  value={shippingAddress.state}
                  onChange={e =>
                    setShippingAddress({
                      ...shippingAddress,
                      state: e.target.value,
                    })
                  }
                >
                  <option value="">— Select —</option>
                  {SHIPPING_STATES.map(s => (
                    <option key={s.code} value={s.code} disabled={!s.allowed}>
                      {s.name}
                      {!s.allowed ? ' — not available' : ''}
                    </option>
                  ))}
                </select>
                <label htmlFor="ship-zip">ZIP</label>
                <input
                  id="ship-zip"
                  value={shippingAddress.zip}
                  onChange={e =>
                    setShippingAddress({
                      ...shippingAddress,
                      zip: e.target.value,
                    })
                  }
                />
                {shippingAddress.state &&
                  !canShipToState(shippingAddress.state) && (
                    <p className="cart-shipping-blocked">
                      We can&apos;t ship to this state. Please choose pickup or
                      a different address.
                    </p>
                  )}
              </div>
            )}

            <label htmlFor="cart-email">Email (for receipt)</label>
            <input
              id="cart-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />

            {checkoutError && (
              <p className="cart-checkout-error" role="alert">
                {checkoutError}
              </p>
            )}

            <button
              type="button"
              className="btn btn-primary cart-checkout-btn"
              disabled={!canCheckout || checkoutLoading}
              aria-disabled={!canCheckout || checkoutLoading}
              onClick={startCheckout}
            >
              {checkoutLoading ? 'Processing…' : 'Verify ID & Checkout'}
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

        <AgeCheckerModal
          open={ageCheckOpen}
          onComplete={r => void handleAgeResult(r)}
          onClose={() => setAgeCheckOpen(false)}
        />
      </div>
    </main>
  );
}
