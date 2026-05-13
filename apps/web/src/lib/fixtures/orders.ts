import type { Order, OrderItem, OrderStatus } from '@/types/order';
import { ONLINE_LOCATION_ID } from '../../constants/location-ids';
import { FIXTURE_TIMESTAMP } from './storefront';

interface OrderFixtureInput {
  id: string;
  status: OrderStatus;
  testMode: boolean;
  locationId: string;
  customerEmail: string;
  customerName: string;
  items: OrderItem[];
  /** Hours offset from FIXTURE_TIMESTAMP for `createdAt`. */
  createdHoursAgo: number;
  cloverPaymentId?: string;
}

const sum = (items: OrderItem[]) =>
  items.reduce((acc, it) => acc + it.lineTotal, 0);

const FLOWER = (qty: number): OrderItem => ({
  productId: 'flower',
  variantId: 'default',
  productName: 'Flower',
  quantity: qty,
  unitPrice: 2500,
  lineTotal: 2500 * qty,
});
const EDIBLES = (qty: number): OrderItem => ({
  productId: 'edibles',
  variantId: 'default',
  productName: 'Edibles',
  quantity: qty,
  unitPrice: 1500,
  lineTotal: 1500 * qty,
});
const DRINKS = (qty: number): OrderItem => ({
  productId: 'drinks',
  variantId: 'default',
  productName: 'Drinks',
  quantity: qty,
  unitPrice: 800,
  lineTotal: 800 * qty,
});
const VAPES = (qty: number): OrderItem => ({
  productId: 'vapes',
  variantId: 'default',
  productName: 'Vapes',
  quantity: qty,
  unitPrice: 3500,
  lineTotal: 3500 * qty,
});
const CONCENTRATES = (qty: number): OrderItem => ({
  productId: 'concentrates',
  variantId: 'default',
  productName: 'Concentrates',
  quantity: qty,
  unitPrice: 4500,
  lineTotal: 4500 * qty,
});

/**
 * One order per (status × testMode) combination plus a multi-location spread,
 * so the admin /admin/orders filters exercise every scenario:
 *   - 6 statuses: paid, preparing, out_for_delivery, completed, cancelled, refunded
 *   - testMode true (sandbox/dev) and false (live)
 *   - location spread across online + 3 retail stores
 */
const ORDER_INPUTS: OrderFixtureInput[] = [
  // ── Live orders (testMode=false) — one per status ──────────────────────
  {
    id: 'ord_live_paid_001',
    status: 'paid',
    testMode: false,
    locationId: ONLINE_LOCATION_ID,
    customerEmail: 'alice.live@example.com',
    customerName: 'Alice Live',
    createdHoursAgo: 1,
    cloverPaymentId: 'CLV_PAY_LIVE_001',
    items: [FLOWER(2)],
  },
  {
    id: 'ord_live_preparing_002',
    status: 'preparing',
    testMode: false,
    locationId: 'oak-ridge',
    customerEmail: 'bob.live@example.com',
    customerName: 'Bob Live',
    createdHoursAgo: 5,
    cloverPaymentId: 'CLV_PAY_LIVE_002',
    items: [EDIBLES(3), DRINKS(1)],
  },
  {
    id: 'ord_live_out_for_delivery_003',
    status: 'out_for_delivery',
    testMode: false,
    locationId: 'maryville',
    customerEmail: 'carol.live@example.com',
    customerName: 'Carol Live',
    createdHoursAgo: 24,
    cloverPaymentId: 'CLV_PAY_LIVE_003',
    items: [VAPES(1)],
  },
  {
    id: 'ord_live_completed_004',
    status: 'completed',
    testMode: false,
    locationId: 'seymour',
    customerEmail: 'dan.live@example.com',
    customerName: 'Dan Live',
    createdHoursAgo: 72,
    cloverPaymentId: 'CLV_PAY_LIVE_004',
    items: [CONCENTRATES(1), FLOWER(1)],
  },
  {
    id: 'ord_live_cancelled_005',
    status: 'cancelled',
    testMode: false,
    locationId: ONLINE_LOCATION_ID,
    customerEmail: 'erin.live@example.com',
    customerName: 'Erin Live',
    createdHoursAgo: 48,
    items: [DRINKS(2)],
  },
  {
    id: 'ord_live_refunded_006',
    status: 'refunded',
    testMode: false,
    locationId: 'oak-ridge',
    customerEmail: 'frank.live@example.com',
    customerName: 'Frank Live',
    createdHoursAgo: 120,
    cloverPaymentId: 'CLV_PAY_LIVE_006',
    items: [EDIBLES(1)],
  },
  // ── Test-mode orders (testMode=true) — one per status ──────────────────
  {
    id: 'ord_test_paid_007',
    status: 'paid',
    testMode: true,
    locationId: ONLINE_LOCATION_ID,
    customerEmail: 'gina.test@example.com',
    customerName: 'Gina Test',
    createdHoursAgo: 2,
    cloverPaymentId: 'CLV_PAY_TEST_007',
    items: [FLOWER(1)],
  },
  {
    id: 'ord_test_preparing_008',
    status: 'preparing',
    testMode: true,
    locationId: 'maryville',
    customerEmail: 'hank.test@example.com',
    customerName: 'Hank Test',
    createdHoursAgo: 6,
    cloverPaymentId: 'CLV_PAY_TEST_008',
    items: [VAPES(2)],
  },
  {
    id: 'ord_test_out_for_delivery_009',
    status: 'out_for_delivery',
    testMode: true,
    locationId: 'seymour',
    customerEmail: 'ivy.test@example.com',
    customerName: 'Ivy Test',
    createdHoursAgo: 26,
    cloverPaymentId: 'CLV_PAY_TEST_009',
    items: [DRINKS(3)],
  },
  {
    id: 'ord_test_completed_010',
    status: 'completed',
    testMode: true,
    locationId: ONLINE_LOCATION_ID,
    customerEmail: 'jack.test@example.com',
    customerName: 'Jack Test',
    createdHoursAgo: 80,
    cloverPaymentId: 'CLV_PAY_TEST_010',
    items: [CONCENTRATES(2)],
  },
  {
    id: 'ord_test_cancelled_011',
    status: 'cancelled',
    testMode: true,
    locationId: 'oak-ridge',
    customerEmail: 'kate.test@example.com',
    customerName: 'Kate Test',
    createdHoursAgo: 50,
    items: [EDIBLES(2), DRINKS(1)],
  },
  {
    id: 'ord_test_refunded_012',
    status: 'refunded',
    testMode: true,
    locationId: 'maryville',
    customerEmail: 'leo.test@example.com',
    customerName: 'Leo Test',
    createdHoursAgo: 144,
    cloverPaymentId: 'CLV_PAY_TEST_012',
    items: [FLOWER(1), VAPES(1)],
  },
];

const TAX_BPS = 950; // 9.5%

export function buildOrderDocuments(
  baseTimestamp: Date = new Date(FIXTURE_TIMESTAMP)
): Order[] {
  return ORDER_INPUTS.map(input => {
    const createdAt = new Date(
      baseTimestamp.getTime() - input.createdHoursAgo * 60 * 60 * 1000
    );
    const subtotal = sum(input.items);
    const tax = Math.round((subtotal * TAX_BPS) / 10_000);
    const total = subtotal + tax;

    const order: Order = {
      id: input.id,
      items: input.items,
      subtotal,
      tax,
      total,
      locationId: input.locationId,
      deliveryAddress: {
        name: input.customerName,
        line1: '123 Test Lane',
        city: 'Knoxville',
        state: 'TN',
        zip: '37902',
      },
      status: input.status,
      testMode: input.testMode,
      checkoutSessionId: `cs_fixture_${input.id}`,
      cloverCheckoutSessionId: `clv_cs_${input.id}`,
      cloverPaymentId: input.cloverPaymentId,
      customerEmail: input.customerEmail,
      createdAt,
      updatedAt: createdAt,
      paidAt: input.status !== 'cancelled' ? createdAt : undefined,
      preparingAt: [
        'preparing',
        'out_for_delivery',
        'completed',
        'refunded',
      ].includes(input.status)
        ? new Date(createdAt.getTime() + 10 * 60 * 1000)
        : undefined,
      dispatchedAt: ['out_for_delivery', 'completed', 'refunded'].includes(
        input.status
      )
        ? new Date(createdAt.getTime() + 60 * 60 * 1000)
        : undefined,
      completedAt: ['completed', 'refunded'].includes(input.status)
        ? new Date(createdAt.getTime() + 3 * 60 * 60 * 1000)
        : undefined,
      cancelledAt:
        input.status === 'cancelled'
          ? new Date(createdAt.getTime() + 15 * 60 * 1000)
          : undefined,
      refundedAt:
        input.status === 'refunded'
          ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000)
          : undefined,
    };

    return order;
  });
}

export const ORDER_FIXTURES = ORDER_INPUTS;
