import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createOrderMock, setOrderProviderRefsMock, startSessionMock } =
  vi.hoisted(() => ({
    createOrderMock: vi.fn(),
    setOrderProviderRefsMock: vi.fn(),
    startSessionMock: vi.fn(),
  }));

vi.mock('@/lib/repositories', () => ({
  createOrder: createOrderMock,
  setOrderProviderRefs: setOrderProviderRefsMock,
}));

vi.mock('@/lib/agechecker', () => ({
  startAgeCheckerSession: startSessionMock,
}));

import { POST } from './route';
import type { OrderItem, ShippingAddress } from '@/types';

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/order/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const SAMPLE_ITEMS: OrderItem[] = [
  {
    productId: 'p1',
    productName: 'Widget',
    quantity: 1,
    unitPrice: 1000,
    lineTotal: 1000,
  },
];

const TN_ADDRESS: ShippingAddress = {
  name: 'KB',
  line1: '1 Main',
  city: 'Knoxville',
  state: 'TN',
  zip: '37902',
};

describe('POST /api/order/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createOrderMock.mockResolvedValue('order-123');
    startSessionMock.mockResolvedValue({
      sessionId: 'ac-sess-1',
      redirectUrl: 'https://agechecker.example/verify/ac-sess-1',
      provider: 'stub',
    });
    setOrderProviderRefsMock.mockResolvedValue(undefined);
  });

  it('creates a pending_id_verification order, starts agechecker, returns redirect URL', async () => {
    // Justified cast: NextRequest accepts a Request at runtime.
    const res = await POST(
      makeReq({
        items: SAMPLE_ITEMS,
        subtotal: 1000,
        tax: 92,
        total: 1092,
        locationId: 'online',
        deliveryAddress: TN_ADDRESS,
        customerEmail: 'kb@example.com',
      }) as unknown as import('next/server').NextRequest
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      orderId: string;
      agecheckerRedirectUrl: string;
    };
    expect(body.orderId).toBe('order-123');
    expect(body.agecheckerRedirectUrl).toContain('agechecker');

    expect(createOrderMock).toHaveBeenCalledTimes(1);
    expect(createOrderMock.mock.calls[0][0]).toMatchObject({
      status: 'pending_id_verification',
      deliveryAddress: TN_ADDRESS,
    });
    expect(startSessionMock).toHaveBeenCalledWith({
      orderId: 'order-123',
      customerEmail: 'kb@example.com',
      returnUrl: 'http://localhost/order/order-123',
    });
    expect(setOrderProviderRefsMock).toHaveBeenCalledWith('order-123', {
      agecheckerSessionId: 'ac-sess-1',
    });
  });

  it('rejects an empty cart', async () => {
    const res = await POST(
      makeReq({
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        locationId: 'online',
        deliveryAddress: TN_ADDRESS,
      }) as unknown as import('next/server').NextRequest
    );
    expect(res.status).toBe(400);
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it('rejects a delivery state we cannot ship to', async () => {
    const res = await POST(
      makeReq({
        items: SAMPLE_ITEMS,
        subtotal: 1000,
        tax: 0,
        total: 1000,
        locationId: 'online',
        deliveryAddress: { ...TN_ADDRESS, state: 'ID' },
      }) as unknown as import('next/server').NextRequest
    );
    expect(res.status).toBe(422);
    expect(createOrderMock).not.toHaveBeenCalled();
  });
});
