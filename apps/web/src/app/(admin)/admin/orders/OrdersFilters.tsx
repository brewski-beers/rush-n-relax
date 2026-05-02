'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { OrderStatus } from '@/types';

const STATUS_OPTIONS: OrderStatus[] = [
  'pending_id_verification',
  'id_verified',
  'id_rejected',
  'awaiting_payment',
  'paid',
  'preparing',
  'out_for_delivery',
  'completed',
  'cancelled',
  'refunded',
  'failed',
];

export interface LocationOption {
  id: string;
  name: string;
}

interface Props {
  locations: LocationOption[];
  initial: {
    status?: string;
    locationId?: string;
    from?: string;
    to?: string;
    q?: string;
  };
}

/**
 * Admin /orders filter bar. Submits via the URL — the parent Server Component
 * re-renders against the new searchParams. Resetting clears all filters and
 * pagination cursors so the user lands on page 1.
 */
export function OrdersFilters({ locations, initial }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(initial.status ?? '');
  const [locationId, setLocationId] = useState(initial.locationId ?? '');
  const [from, setFrom] = useState(initial.from ?? '');
  const [to, setTo] = useState(initial.to ?? '');
  const [q, setQ] = useState(initial.q ?? '');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (locationId) params.set('locationId', locationId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (q) params.set('q', q);
    const qs = params.toString();
    router.push(qs ? `/admin/orders?${qs}` : '/admin/orders');
  }

  function handleReset() {
    setStatus('');
    setLocationId('');
    setFrom('');
    setTo('');
    setQ('');
    router.push('/admin/orders');
  }

  // Hidden indicator that searchParams hook is wired (used by tests to
  // avoid an unused-import lint without behavior coupling).
  const _hasParams = searchParams.toString().length > 0;
  void _hasParams;

  return (
    <form
      className="admin-filters"
      onSubmit={handleSubmit}
      aria-label="Order filters"
    >
      <label>
        <span>Status</span>
        <select
          name="status"
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          <option value="">All</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Location</span>
        <select
          name="locationId"
          value={locationId}
          onChange={e => setLocationId(e.target.value)}
        >
          <option value="">All</option>
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>From</span>
        <input
          type="date"
          name="from"
          value={from}
          onChange={e => setFrom(e.target.value)}
        />
      </label>
      <label>
        <span>To</span>
        <input
          type="date"
          name="to"
          value={to}
          onChange={e => setTo(e.target.value)}
        />
      </label>
      <label>
        <span>Email</span>
        <input
          type="search"
          name="q"
          placeholder="customer@example.com"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </label>
      <div className="admin-filters-actions">
        <button type="submit" className="admin-btn-primary">
          Apply
        </button>
        <button
          type="button"
          className="admin-btn-secondary"
          onClick={handleReset}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
