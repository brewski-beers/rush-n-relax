'use client';

import {
  SHIPPING_STATES,
  canShipToState,
  getShippingBlockReason,
} from '@/constants/shipping';
import type { ShippingAddress } from '@/types';

export interface DeliveryDetailsFormProps {
  address: ShippingAddress;
  email: string;
  onAddressChange: (address: ShippingAddress) => void;
  onEmailChange: (email: string) => void;
}

/**
 * Controlled form capturing the customer's delivery address and email
 * before launching the ID-check / checkout flow.
 *
 * State eligibility is enforced via `canShipToState` and surfaced via
 * `getShippingBlockReason`. Email is captured separately because
 * `ShippingAddress` is the on-disk shape and intentionally does not
 * include email.
 */
export function DeliveryDetailsForm({
  address,
  email,
  onAddressChange,
  onEmailChange,
}: DeliveryDetailsFormProps) {
  const blockReason = address.state
    ? getShippingBlockReason(address.state)
    : null;
  const stateAllowed = !!address.state && canShipToState(address.state);

  function update<K extends keyof ShippingAddress>(
    key: K,
    value: ShippingAddress[K]
  ) {
    onAddressChange({ ...address, [key]: value });
  }

  return (
    <div className="cart-delivery-details">
      <fieldset className="cart-shipping-form">
        <legend>Delivery Address</legend>

        <label htmlFor="ship-name">Full name</label>
        <input
          id="ship-name"
          required
          value={address.name}
          onChange={e => update('name', e.target.value)}
        />

        <label htmlFor="ship-line1">Street address</label>
        <input
          id="ship-line1"
          required
          value={address.line1}
          onChange={e => update('line1', e.target.value)}
        />

        <label htmlFor="ship-line2">Apt / Suite (optional)</label>
        <input
          id="ship-line2"
          value={address.line2 ?? ''}
          onChange={e => update('line2', e.target.value)}
        />

        <label htmlFor="ship-city">City</label>
        <input
          id="ship-city"
          required
          value={address.city}
          onChange={e => update('city', e.target.value)}
        />

        <label htmlFor="ship-state">State</label>
        <select
          id="ship-state"
          required
          value={address.state}
          onChange={e => update('state', e.target.value)}
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
          required
          inputMode="numeric"
          value={address.zip}
          onChange={e => update('zip', e.target.value)}
        />

        {address.state && !stateAllowed && blockReason && (
          <p className="cart-shipping-blocked" role="alert">
            {blockReason}
          </p>
        )}
      </fieldset>

      <label htmlFor="cart-email">Email (for receipt)</label>
      <input
        id="cart-email"
        type="email"
        required
        value={email}
        onChange={e => onEmailChange(e.target.value)}
      />
    </div>
  );
}
