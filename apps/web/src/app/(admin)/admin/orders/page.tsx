export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireRole } from '@/lib/admin-auth';
import { listOrders } from '@/lib/repositories';
import { LOCATIONS } from '@/constants/locations';
import { AdminTablePagination } from '@/components/admin/AdminTablePagination';
import { OrdersFilters } from './OrdersFilters';
import type { OrderStatus } from '@/types';

interface SearchParams {
  status?: string;
  locationId?: string;
  from?: string;
  to?: string;
  q?: string;
  showTest?: string;
  cursor?: string;
  prevCursors?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

const VALID_STATUSES: ReadonlySet<OrderStatus> = new Set([
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
]);

function parseDate(input: string | undefined): Date | undefined {
  if (!input) return undefined;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function buildBaseHref(sp: SearchParams): string {
  const params = new URLSearchParams();
  if (sp.status) params.set('status', sp.status);
  if (sp.locationId) params.set('locationId', sp.locationId);
  if (sp.from) params.set('from', sp.from);
  if (sp.to) params.set('to', sp.to);
  if (sp.q) params.set('q', sp.q);
  if (sp.showTest) params.set('showTest', sp.showTest);
  const qs = params.toString();
  return qs ? `/admin/orders?${qs}` : '/admin/orders';
}

export default async function AdminOrdersPage({ searchParams }: Props) {
  await requireRole('staff');

  const sp = await searchParams;
  const status =
    sp.status && VALID_STATUSES.has(sp.status as OrderStatus)
      ? (sp.status as OrderStatus)
      : undefined;
  const locationId = sp.locationId || undefined;
  const dateFrom = parseDate(sp.from);
  const dateTo = parseDate(sp.to);
  const search = sp.q?.trim() || undefined;
  // Default behavior: hide test-mode orders. Admin must opt in via
  // ?showTest=true to see them alongside live orders.
  const showTest = sp.showTest === 'true';
  const testModeFilter = showTest ? undefined : false;

  const prevCursors = sp.prevCursors
    ? sp.prevCursors.split(',').filter(Boolean)
    : [];

  const { orders, nextCursor } = await listOrders({
    status,
    locationId,
    dateFrom,
    dateTo,
    search,
    testMode: testModeFilter,
    cursor: sp.cursor,
    limit: 50,
  });

  const prevCursor = prevCursors.at(-1);
  const prevStack = prevCursors.slice(0, -1);
  const nextStack = sp.cursor ? [...prevCursors, sp.cursor] : prevCursors;

  const locationOptions = LOCATIONS.map(l => ({ id: l.slug, name: l.name }));

  return (
    <>
      <div className="admin-page-header">
        <h1>Orders</h1>
      </div>
      <OrdersFilters
        locations={locationOptions}
        initial={{
          status: sp.status,
          locationId: sp.locationId,
          from: sp.from,
          to: sp.to,
          q: sp.q,
          showTest: sp.showTest,
        }}
      />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Created</th>
              <th>Status</th>
              <th>Location</th>
              <th>Customer</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id} data-status={order.status}>
                <td>
                  <Link href={`/admin/orders/${order.id}`}>{order.id}</Link>
                  {order.testMode ? (
                    <span
                      className="admin-status-badge admin-test-pill"
                      data-testid="test-pill"
                    >
                      TEST
                    </span>
                  ) : null}
                </td>
                <td>{order.createdAt.toLocaleString()}</td>
                <td>
                  <span
                    className={`admin-status-badge admin-status-${order.status}`}
                  >
                    {order.status}
                  </span>
                </td>
                <td>{order.locationId}</td>
                <td>{order.customerEmail ?? '—'}</td>
                <td>{formatCents(order.total)}</td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-empty">
                  No orders match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <AdminTablePagination
        baseHref={buildBaseHref(sp)}
        prevCursor={prevCursor}
        nextCursor={nextCursor}
        prevCursorsStack={prevStack}
        nextCursorsStack={nextStack}
      />
    </>
  );
}
