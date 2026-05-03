import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getOrderMock,
  transitionStatusMock,
  setOrderProviderRefsMock,
  createCloverMock,
  FakeInvalidTransitionError,
} = vi.hoisted(() => {
  class FakeInvalidTransitionError extends Error {
    readonly from: string | null;
    readonly to: string;
    constructor(from: string | null, to: string) {
      super(`Invalid order status transition: ${from ?? 'null'} → ${to}`);
      this.name = 'InvalidTransitionError';
      this.from = from;
      this.to = to;
    }
  }
  return {
    getOrderMock: vi.fn(),
    transitionStatusMock: vi.fn(),
    setOrderProviderRefsMock: vi.fn(),
    createCloverMock: vi.fn(),
    FakeInvalidTransitionError,
  };
});

vi.mock('@/lib/repositories', () => ({
  getOrder: getOrderMock,
  transitionStatus: transitionStatusMock,
  setOrderProviderRefs: setOrderProviderRefsMock,
  InvalidTransitionError: FakeInvalidTransitionError,
}));

vi.mock('@/lib/clover/checkout', () => ({
  createCloverCheckoutSession: createCloverMock,
}));

import { POST } from './route';

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/checkout/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/checkout/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createCloverMock.mockResolvedValue({
      redirectUrl: '/checkout/stub?order=order-1',
      sessionId: 'stub-order-1',
      provider: 'stub',
    });
    transitionStatusMock.mockResolvedValue({ id: 'order-1' });
    setOrderProviderRefsMock.mockResolvedValue(undefined);
  });

  it('opens a Clover session when the order is id_verified', async () => {
    getOrderMock.mockResolvedValue({
      id: 'order-1',
      status: 'id_verified',
      total: 1500,
      customerEmail: 'kb@example.com',
      items: [
        {
          productId: 'p1',
          productName: 'Hat',
          quantity: 1,
          unitPrice: 1500,
          lineTotal: 1500,
        },
      ],
    });

    const res = await POST(
      makeReq({
        orderId: 'order-1',
      }) as unknown as import('next/server').NextRequest
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { redirectUrl: string };
    expect(body.redirectUrl).toContain('/checkout/stub');

    expect(transitionStatusMock).toHaveBeenCalledWith(
      'order-1',
      'awaiting_payment',
      'system'
    );
    expect(createCloverMock).toHaveBeenCalledWith({
      orderId: 'order-1',
      amount: 1500,
      customerEmail: 'kb@example.com',
      lineItems: [{ name: 'Hat', quantity: 1, unitPrice: 1500 }],
    });
    expect(setOrderProviderRefsMock).toHaveBeenCalledWith('order-1', {
      cloverCheckoutSessionId: 'stub-order-1',
    });
  });

  it('returns 409 when the order is still pending_id_verification', async () => {
    getOrderMock.mockResolvedValue({
      id: 'order-2',
      status: 'pending_id_verification',
      total: 1000,
      items: [],
    });

    const res = await POST(
      makeReq({
        orderId: 'order-2',
      }) as unknown as import('next/server').NextRequest
    );

    expect(res.status).toBe(409);
    expect(transitionStatusMock).not.toHaveBeenCalled();
    expect(createCloverMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the order does not exist', async () => {
    getOrderMock.mockResolvedValue(null);

    const res = await POST(
      makeReq({
        orderId: 'missing',
      }) as unknown as import('next/server').NextRequest
    );

    expect(res.status).toBe(404);
  });

  it('returns 400 when orderId is missing', async () => {
    const res = await POST(
      makeReq({}) as unknown as import('next/server').NextRequest
    );
    expect(res.status).toBe(400);
  });
});
