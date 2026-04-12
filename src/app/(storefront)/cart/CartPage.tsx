'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { callFunction } from '@/firebase';
import { formatCents } from '@/utils/currency';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Mirrors InitiatePaymentRequest from functions/initiatePayment.ts */
interface InitiatePaymentRequest {
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }[];
  fulfillmentType: 'pickup' | 'shipping';
  locationId: string;
  customerEmail?: string;
}

interface InitiatePaymentResponse {
  orderId: string;
  paymentUrl: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

type FulfillmentType = 'pickup' | 'ship';

const PICKUP_LOCATIONS = [
  { id: 'oak-ridge', name: 'Oak Ridge' },
  { id: 'maryville', name: 'Maryville' },
  { id: 'seymour', name: 'Seymour' },
] as const;

// Flat TN tax placeholder — real tax computed server-side at initiatePayment.
const TAX_RATE = 0.0925;

// ── Component ─────────────────────────────────────────────────────────────────

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQty, total, clearCart } = useCart();

  const [fulfillment, setFulfillment] = useState<FulfillmentType | null>(null);
  const [pickupLocation, setPickupLocation] = useState<string>('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const hasOnlineItems = items.some(() => true);

  const canCheckout =
    !isCheckingOut &&
    (fulfillment === 'ship' ||
      (fulfillment === 'pickup' && pickupLocation !== ''));

  // ── Age gate compliance: user must have accepted the age gate. ──────────────
  // The age gate sets a localStorage/cookie value. The gate itself wraps the
  // app layout — if a user reaches /cart they have already passed the gate.
  // No additional check needed here beyond what the AgeGate layout enforces.

  const handleCheckout = async () => {
    if (!canCheckout || !fulfillment) return;
    setIsCheckingOut(true);
    setCheckoutError(null);

    try {
      const locationId =
        fulfillment === 'pickup' ? pickupLocation : 'online';

      const result = await callFunction<
        InitiatePaymentRequest,
        InitiatePaymentResponse
      >('initiatePayment')({
        items: items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        fulfillmentType: fulfillment === 'ship' ? 'shipping' : 'pickup',
        locationId,
      });

      // Redirect to Redde-hosted payment page in the same tab.
      // Cart is NOT cleared here — cleared only after confirmed paid event.
      router.push(result.paymentUrl);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.';
      setCheckoutError(message);
      setIsCheckingOut(false);
    }
  };

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
              onClick={handleCheckout}
            >
              {isCheckingOut ? 'Processing…' : 'Proceed to Checkout'}
            </button>

            {checkoutError && (
              <p className="cart-checkout-error" role="alert">
                {checkoutError}
              </p>
            )}

            <button
              type="button"
              className="cart-clear-btn"
              onClick={clearCart}
              disabled={isCheckingOut}
            >
              Clear cart
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}
