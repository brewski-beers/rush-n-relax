import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getOrderMock,
  setOrderProviderRefsMock,
  transitionStatusMock,
  InvalidTransitionErrorMock,
  getCloverPaymentForOrderMock,
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
  return {
    getOrderMock: vi.fn(),
    setOrderProviderRefsMock: vi.fn().mockResolvedValue(undefined),
    transitionStatusMock: vi.fn(),
    InvalidTransitionErrorMock,
    getCloverPaymentForOrderMock: vi.fn(),
  };
});

vi.mock('@/lib/repositories', () => ({
  getOrder: getOrderMock,
  setOrderProviderRefs: setOrderProviderRefsMock,
  transitionStatus: transitionStatusMock,
  InvalidTransitionError: InvalidTransitionErrorMock,
}));

vi.mock('@/lib/clover/checkout', () => ({
  getCloverPaymentForOrder: getCloverPaymentForOrderMock,
}));

import { GET } from '@/app/(storefront)/order/[id]/return/route';

function makeReq(
  orderId: string,
  query: Record<string, string> = {}
): NextRequest {
  const qs = new URLSearchParams(query).toString();
  const url = `http://localhost/order/${orderId}/return${qs ? `?${qs}` : ''}`;
  return new NextRequest(url, { method: 'GET' });
}

function ctx(orderId: string) {
  return { params: Promise.resolve({ id: orderId }) };
}

const baseOrder = {
  id: 'ord_1',
  status: 'awaiting_payment' as const,
  cloverCheckoutSessionId: 'cco_1',
};

describe('GET /order/[id]/return — Path B reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transitionStatusMock.mockResolvedValue({ id: 'ord_1' });
  });

  it('404s when the order is unknown', async () => {
    getOrderMock.mockResolvedValue(null);
    const res = await GET(makeReq('ord_404'), ctx('ord_404'));
    expect(res.status).toBe(404);
    expect(transitionStatusMock).not.toHaveBeenCalled();
  });

  it('SUCCESS payment → transitions order to paid and redirects to /order/{id}', async () => {
    getOrderMock.mockResolvedValue(baseOrder);
    getCloverPaymentForOrderMock.mockResolvedValue({
      result: 'SUCCESS',
      paymentId: 'pay_1',
    });
    const res = await GET(makeReq('ord_1'), ctx('ord_1'));
    expect(transitionStatusMock).toHaveBeenCalledWith(
      'ord_1',
      'paid',
      'system',
      expect.objectContaining({ cloverPaymentId: 'pay_1' })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/order/ord_1');
  });

  it('FAIL payment → transitions order to failed', async () => {
    getOrderMock.mockResolvedValue(baseOrder);
    getCloverPaymentForOrderMock.mockResolvedValue({ result: 'FAIL' });
    await GET(makeReq('ord_1'), ctx('ord_1'));
    expect(transitionStatusMock).toHaveBeenCalledWith(
      'ord_1',
      'failed',
      'system',
      expect.objectContaining({ reason: 'clover-payment-failed' })
    );
  });

  it('PENDING → leaves the order alone (no transition) so the recovery cron retries', async () => {
    getOrderMock.mockResolvedValue(baseOrder);
    getCloverPaymentForOrderMock.mockResolvedValue({ result: 'PENDING' });
    const res = await GET(makeReq('ord_1'), ctx('ord_1'));
    expect(transitionStatusMock).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
  });

  it('idempotent: when order is already paid, redirects without calling Clover', async () => {
    getOrderMock.mockResolvedValue({ ...baseOrder, status: 'paid' });
    const res = await GET(makeReq('ord_1'), ctx('ord_1'));
    expect(getCloverPaymentForOrderMock).not.toHaveBeenCalled();
    expect(transitionStatusMock).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/order/ord_1');
  });

  it('idempotent: an InvalidTransitionError from a duplicate call is silently swallowed', async () => {
    getOrderMock.mockResolvedValue(baseOrder);
    getCloverPaymentForOrderMock.mockResolvedValue({
      result: 'SUCCESS',
      paymentId: 'pay_1',
    });
    transitionStatusMock.mockRejectedValueOnce(
      new InvalidTransitionErrorMock('paid', 'paid')
    );
    const res = await GET(makeReq('ord_1'), ctx('ord_1'));
    expect(res.status).toBe(307);
  });

  it('Clover API throw → redirects without transitioning (recovery cron will retry)', async () => {
    getOrderMock.mockResolvedValue(baseOrder);
    getCloverPaymentForOrderMock.mockRejectedValue(new Error('network'));
    const res = await GET(makeReq('ord_1'), ctx('ord_1'));
    expect(res.status).toBe(307);
    expect(transitionStatusMock).not.toHaveBeenCalled();
  });

  it('uses query-param Clover order id when provided in preference to the stored session id', async () => {
    getOrderMock.mockResolvedValue(baseOrder);
    getCloverPaymentForOrderMock.mockResolvedValue({ result: 'PENDING' });
    await GET(makeReq('ord_1', { orderId: 'cco_QS' }), ctx('ord_1'));
    expect(getCloverPaymentForOrderMock).toHaveBeenCalledWith('cco_QS');
  });

  it('falls back to stored cloverCheckoutSessionId when no query params present', async () => {
    getOrderMock.mockResolvedValue(baseOrder);
    getCloverPaymentForOrderMock.mockResolvedValue({ result: 'PENDING' });
    await GET(makeReq('ord_1'), ctx('ord_1'));
    expect(getCloverPaymentForOrderMock).toHaveBeenCalledWith('cco_1');
  });
});
