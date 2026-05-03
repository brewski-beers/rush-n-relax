import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requireRoleMock,
  getOrderMock,
  transitionStatusMock,
  InvalidTransitionErrorMock,
  refundCloverPaymentMock,
  outboundEmailsAddMock,
  eventGetMock,
  collectionMock,
  getAdminFirestoreMock,
  revalidatePathMock,
} = vi.hoisted(() => {
  class InvalidTransitionErrorMock extends Error {
    readonly from: string | null;
    readonly to: string;
    constructor(from: string | null, to: string) {
      super(`invalid: ${from ?? 'null'} -> ${to}`);
      this.name = 'InvalidTransitionError';
      this.from = from;
      this.to = to;
    }
  }
  const requireRoleMock = vi.fn();
  const getOrderMock = vi.fn();
  const transitionStatusMock = vi.fn();
  const refundCloverPaymentMock = vi.fn();
  const outboundEmailsAddMock = vi.fn().mockResolvedValue({ id: 'job-1' });
  const eventGetMock = vi.fn();
  const eventDocMock = vi.fn(() => ({ get: eventGetMock }));
  const eventsCollectionMock = vi.fn(() => ({ doc: eventDocMock }));
  const orderEventsDocMock = vi.fn(() => ({
    collection: eventsCollectionMock,
  }));
  const collectionMock = vi.fn((name: string) => {
    if (name === 'order-events') return { doc: orderEventsDocMock };
    if (name === 'outbound-emails') return { add: outboundEmailsAddMock };
    return { doc: vi.fn() };
  });
  const getAdminFirestoreMock = vi.fn(() => ({ collection: collectionMock }));
  const revalidatePathMock = vi.fn();
  return {
    requireRoleMock,
    getOrderMock,
    transitionStatusMock,
    InvalidTransitionErrorMock,
    refundCloverPaymentMock,
    outboundEmailsAddMock,
    eventGetMock,
    collectionMock,
    getAdminFirestoreMock,
    revalidatePathMock,
  };
});

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/lib/admin-auth', () => ({ requireRole: requireRoleMock }));
vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: getAdminFirestoreMock,
}));
vi.mock('@/lib/repositories', () => ({
  getOrder: getOrderMock,
  transitionStatus: transitionStatusMock,
  InvalidTransitionError: InvalidTransitionErrorMock,
}));
vi.mock('@/lib/clover/checkout', () => ({
  refundCloverPayment: refundCloverPaymentMock,
}));

import {
  refundOrderAction,
  resendOrderEmailAction,
  transitionOrderAction,
} from '@/app/(admin)/admin/orders/[id]/actions';

const ADMIN = { uid: 'admin_uid_1', email: 'admin@rushnrelax.com' };

const baseOrder = {
  id: 'ord_1',
  status: 'paid' as const,
  total: 5000,
  cloverPaymentId: 'pay_1',
  customerEmail: 'buyer@example.com',
  deliveryAddress: { name: 'Buyer Name' },
};

describe('admin order Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockResolvedValue(ADMIN);
  });

  // ── transitionOrderAction ─────────────────────────────────────────────

  describe('transitionOrderAction', () => {
    it('writes admin:{uid} actor on the event log', async () => {
      getOrderMock.mockResolvedValue({ ...baseOrder, status: 'preparing' });
      transitionStatusMock.mockResolvedValue({ id: 'ord_1' });
      const res = await transitionOrderAction('ord_1', 'out_for_delivery');
      expect(res.ok).toBe(true);
      expect(transitionStatusMock).toHaveBeenCalledWith(
        'ord_1',
        'out_for_delivery',
        `admin:${ADMIN.uid}`,
        expect.objectContaining({ adminEmail: ADMIN.email })
      );
    });

    it('rejects a transition not in ALLOWED_TRANSITIONS', async () => {
      getOrderMock.mockResolvedValue({ ...baseOrder, status: 'paid' });
      const res = await transitionOrderAction(
        'ord_1',
        'pending_id_verification'
      );
      expect(res.ok).toBe(false);
      expect(transitionStatusMock).not.toHaveBeenCalled();
    });

    it.each([
      ['pending_id_verification', 'id_verified'],
      ['id_verified', 'awaiting_payment'],
      ['awaiting_payment', 'paid'],
      ['paid', 'preparing'],
      ['preparing', 'out_for_delivery'],
      ['out_for_delivery', 'completed'],
    ] as const)('allows transition %s → %s', async (from, to) => {
      getOrderMock.mockResolvedValue({ ...baseOrder, status: from });
      transitionStatusMock.mockResolvedValue({ id: 'ord_1' });
      const res = await transitionOrderAction('ord_1', to);
      expect(res.ok).toBe(true);
    });

    it('returns ok=false when order is missing', async () => {
      getOrderMock.mockResolvedValue(null);
      const res = await transitionOrderAction('missing', 'cancelled');
      expect(res).toEqual({ ok: false, error: 'Order not found' });
    });
  });

  // ── resendOrderEmailAction ────────────────────────────────────────────

  describe('resendOrderEmailAction', () => {
    it('enqueues an outbound-emails job with the templateId mapped from the event row', async () => {
      eventGetMock.mockResolvedValue({
        exists: true,
        data: () => ({ to: 'paid' }),
      });
      getOrderMock.mockResolvedValue(baseOrder);
      const res = await resendOrderEmailAction('ord_1', 'evt_1');
      expect(res.ok).toBe(true);
      expect(outboundEmailsAddMock).toHaveBeenCalledOnce();
      const job = outboundEmailsAddMock.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(job.templateId).toBe('payment_confirmed');
      expect(job.to).toBe('buyer@example.com');
      expect(job.status).toBe('pending');
      expect(job.resentBy).toBe(`admin:${ADMIN.uid}`);
      expect(job.resentForEventId).toBe('evt_1');
    });

    it('refuses when the event status has no template (e.g. awaiting_payment)', async () => {
      eventGetMock.mockResolvedValue({
        exists: true,
        data: () => ({ to: 'awaiting_payment' }),
      });
      getOrderMock.mockResolvedValue(baseOrder);
      const res = await resendOrderEmailAction('ord_1', 'evt_2');
      expect(res.ok).toBe(false);
      expect(outboundEmailsAddMock).not.toHaveBeenCalled();
    });

    it('refuses when the order has no customer email', async () => {
      eventGetMock.mockResolvedValue({
        exists: true,
        data: () => ({ to: 'paid' }),
      });
      getOrderMock.mockResolvedValue({
        ...baseOrder,
        customerEmail: undefined,
      });
      const res = await resendOrderEmailAction('ord_1', 'evt_3');
      expect(res.ok).toBe(false);
      expect(outboundEmailsAddMock).not.toHaveBeenCalled();
    });
  });

  // ── refundOrderAction ─────────────────────────────────────────────────

  describe('refundOrderAction', () => {
    it('refuses when order is not paid', async () => {
      getOrderMock.mockResolvedValue({ ...baseOrder, status: 'preparing' });
      const res = await refundOrderAction('ord_1');
      expect(res.ok).toBe(false);
      expect(refundCloverPaymentMock).not.toHaveBeenCalled();
    });

    it('calls refundCloverPayment with the stored cloverPaymentId and transitions to refunded', async () => {
      getOrderMock.mockResolvedValue(baseOrder);
      refundCloverPaymentMock.mockResolvedValue({ refundId: 'ref_xyz' });
      transitionStatusMock.mockResolvedValue({ id: 'ord_1' });
      const res = await refundOrderAction('ord_1');
      expect(res.ok).toBe(true);
      expect(refundCloverPaymentMock).toHaveBeenCalledWith('pay_1', undefined);
      expect(transitionStatusMock).toHaveBeenCalledWith(
        'ord_1',
        'refunded',
        `admin:${ADMIN.uid}`,
        expect.objectContaining({
          cloverPaymentId: 'pay_1',
          refundId: 'ref_xyz',
          adminEmail: ADMIN.email,
        })
      );
    });

    it('passes amount through to Clover for partial refunds', async () => {
      getOrderMock.mockResolvedValue(baseOrder);
      refundCloverPaymentMock.mockResolvedValue({ refundId: 'r' });
      transitionStatusMock.mockResolvedValue({ id: 'ord_1' });
      await refundOrderAction('ord_1', 250);
      expect(refundCloverPaymentMock).toHaveBeenCalledWith('pay_1', 250);
    });

    it('reports the Clover error when refund call throws', async () => {
      getOrderMock.mockResolvedValue(baseOrder);
      refundCloverPaymentMock.mockRejectedValue(new Error('clover declined'));
      const res = await refundOrderAction('ord_1');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('clover declined');
      expect(transitionStatusMock).not.toHaveBeenCalled();
    });
  });
});
