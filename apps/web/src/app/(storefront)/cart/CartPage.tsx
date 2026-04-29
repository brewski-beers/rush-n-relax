'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { formatCents } from '@/utils/currency';
import {
  AgeCheckerModal,
  type AgeCheckOutcome,
} from '@/components/AgeCheckerModal/AgeCheckerModal';
import { canShipToState } from '@/constants/shipping';
import type { ShippingAddress } from '@/types';
import { DeliveryDetailsForm } from './DeliveryDetailsForm';

const EMPTY_ADDRESS: ShippingAddress = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  zip: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQty, subtotal, clearCart } = useCart();
  const [deliveryAddress, setDeliveryAddress] =
    useState<ShippingAddress>(EMPTY_ADDRESS);
  const [email, setEmail] = useState('');

  const [ageCheckOpen, setAgeCheckOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const stateAllowed =
    deliveryAddress.state !== '' && canShipToState(deliveryAddress.state);

  const addressComplete =
    !!deliveryAddress.name &&
    !!deliveryAddress.line1 &&
    !!deliveryAddress.city &&
    !!deliveryAddress.state &&
    !!deliveryAddress.zip;

  const emailValid = EMAIL_RE.test(email);
  const canCheckout = stateAllowed && addressComplete && emailValid;

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
            locationId: 'online',
            deliveryAddress,
            agecheckerSessionId: result.verificationId,
            customerEmail: email || undefined,
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
      items,
      subtotal,
      taxEstimate,
      total,
      deliveryAddress,
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

            <DeliveryDetailsForm
              address={deliveryAddress}
              email={email}
              onAddressChange={setDeliveryAddress}
              onEmailChange={setEmail}
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
