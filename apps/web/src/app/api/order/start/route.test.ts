import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createOrderMock,
  setOrderProviderRefsMock,
  decrementInventoryItemsMock,
  InsufficientStockErrorMock,
} = vi.hoisted(() => {
  class InsufficientStockErrorMock extends Error {
    productId: string;
    available: number;
    requested: number;
    constructor(productId: string, available: number, requested: number) {
      super('Insufficient stock');
      this.name = 'InsufficientStockError';
      this.productId = productId;
      this.available = available;
      this.requested = requested;
    }
  }
  return {
    createOrderMock: vi.fn(),
    setOrderProviderRefsMock: vi.fn(),
    decrementInventoryItemsMock: vi.fn(),
    InsufficientStockErrorMock,
  };
});

vi.mock('@/lib/repositories', () => ({
  createOrder: createOrderMock,
  setOrderProviderRefs: setOrderProviderRefsMock,
  decrementInventoryItems: decrementInventoryItemsMock,
  InsufficientStockError: InsufficientStockErrorMock,
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
    setOrderProviderRefsMock.mockResolvedValue(undefined);
    decrementInventoryItemsMock.mockResolvedValue(undefined);
  });

  it('creates an id_verified order, decrements inventory, persists verificationId', async () => {
    const res = await POST(
      makeReq({
        verificationId: 'verif-abc',
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
    const body = (await res.json()) as { orderId: string };
    expect(body.orderId).toBe('order-123');

    expect(createOrderMock).toHaveBeenCalledTimes(1);
    expect(createOrderMock.mock.calls[0][0]).toMatchObject({
      status: 'id_verified',
      deliveryAddress: TN_ADDRESS,
      customerEmail: 'kb@example.com',
    });
    expect(setOrderProviderRefsMock).toHaveBeenCalledWith('order-123', {
      agecheckerSessionId: 'verif-abc',
    });
    expect(decrementInventoryItemsMock).toHaveBeenCalledWith('online', [
      { productId: 'p1', quantity: 1 },
    ]);
  });

  it('rejects an empty cart', async () => {
    const res = await POST(
      makeReq({
        verificationId: 'verif-abc',
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
    expect(decrementInventoryItemsMock).not.toHaveBeenCalled();
  });

  it('rejects 422 when delivery state is non-shippable, BEFORE any other work', async () => {
    const res = await POST(
      makeReq({
        verificationId: 'verif-abc',
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
    expect(setOrderProviderRefsMock).not.toHaveBeenCalled();
    expect(decrementInventoryItemsMock).not.toHaveBeenCalled();
  });

  it('rejects 400 when verificationId is missing', async () => {
    const res = await POST(
      makeReq({
        items: SAMPLE_ITEMS,
        subtotal: 1000,
        tax: 0,
        total: 1000,
        locationId: 'online',
        deliveryAddress: TN_ADDRESS,
      }) as unknown as import('next/server').NextRequest
    );
    expect(res.status).toBe(400);
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it('returns 409 when inventory decrement reports insufficient stock', async () => {
    decrementInventoryItemsMock.mockRejectedValueOnce(
      new InsufficientStockErrorMock('p1', 0, 1)
    );
    const res = await POST(
      makeReq({
        verificationId: 'verif-abc',
        items: SAMPLE_ITEMS,
        subtotal: 1000,
        tax: 0,
        total: 1000,
        locationId: 'online',
        deliveryAddress: TN_ADDRESS,
      }) as unknown as import('next/server').NextRequest
    );
    expect(res.status).toBe(409);
  });
});
