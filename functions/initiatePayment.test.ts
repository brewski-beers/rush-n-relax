/**
 * Unit tests for initiatePayment Cloud Function.
 * Mocks Firestore and Redde HTTP call — never hits real APIs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CartItem } from './initiatePayment';

// ── Hoisted mock state ────────────────────────────────────────────────────────

const {
  mockSet,
  mockUpdate,
  mockDocRef,
  mockCollection,
  mockFetch,
  mockApiKeyRef,
} = vi.hoisted(() => {
  let docIdCounter = 0;
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockDocRef = vi.fn(() => ({
    id: `order-${++docIdCounter}`,
    set: mockSet,
    update: mockUpdate,
  }));
  const mockCollection = vi.fn(() => ({ doc: mockDocRef }));
  const mockFetch = vi.fn();
  const mockApiKeyRef = { value: 'test-redde-key' };
  return {
    mockSet,
    mockUpdate,
    mockDocRef,
    mockCollection,
    mockFetch,
    mockApiKeyRef,
  };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({ collection: mockCollection })),
}));

vi.mock('firebase-admin/app', () => ({
  getApps: vi.fn(() => [{}]),
  initializeApp: vi.fn(),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_opts: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('firebase-functions/params', () => ({
  defineSecret: vi.fn(() => mockApiKeyRef),
}));

vi.mock('firebase-functions/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

global.fetch = mockFetch as typeof fetch;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeItems(overrides: Partial<CartItem> = {}): CartItem[] {
  return [
    {
      productId: 'prod-1',
      productName: 'Blue Dream 3.5g',
      quantity: 2,
      unitPrice: 3500,
      ...overrides,
    },
  ];
}

function mockReddeSuccess() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      txnId: 'rde_txn_abc123',
      paymentUrl: 'https://pay.reddedashboard.com/checkout/rde_txn_abc123',
      status: 'pending',
    }),
  });
}

function mockReddeFailure(status = 502) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ message: 'Gateway error' }),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('initiatePayment', () => {
  let handler: (req: { data: unknown }) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockApiKeyRef.value = 'test-redde-key';
    const mod = await import('./initiatePayment');
    // onCall mock returns the handler directly
    handler = mod.initiatePayment as unknown as typeof handler;
  });

  describe('validation', () => {
    it('throws invalid-argument when items is empty', async () => {
      await expect(
        handler({
          data: {
            items: [],
            fulfillmentType: 'pickup',
            locationId: 'oak-ridge',
          },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('throws invalid-argument when an item has unitPrice 0', async () => {
      await expect(
        handler({
          data: {
            items: makeItems({ unitPrice: 0 }),
            fulfillmentType: 'pickup',
            locationId: 'oak-ridge',
          },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('throws invalid-argument for unknown fulfillmentType', async () => {
      await expect(
        handler({
          data: {
            items: makeItems(),
            fulfillmentType: 'drone',
            locationId: 'oak-ridge',
          },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('throws invalid-argument when locationId is missing', async () => {
      await expect(
        handler({
          data: {
            items: makeItems(),
            fulfillmentType: 'pickup',
            locationId: '',
          },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });
  });

  describe('happy path', () => {
    it('creates an order doc before calling Redde', async () => {
      mockReddeSuccess();
      await handler({
        data: {
          items: makeItems(),
          fulfillmentType: 'pickup',
          locationId: 'oak-ridge',
          customerEmail: 'test@example.com',
        },
      });
      expect(mockSet).toHaveBeenCalledOnce();
      const setArg = mockSet.mock.calls[0][0] as Record<string, unknown>;
      expect(setArg.status).toBe('pending');
      expect(setArg.locationId).toBe('oak-ridge');
    });

    it('returns orderId and paymentUrl on success', async () => {
      mockReddeSuccess();
      const result = await handler({
        data: {
          items: makeItems(),
          fulfillmentType: 'pickup',
          locationId: 'oak-ridge',
        },
      });
      expect(result).toMatchObject({
        orderId: expect.any(String),
        paymentUrl: 'https://pay.reddedashboard.com/checkout/rde_txn_abc123',
      });
    });

    it('calls Redde API with correct Authorization header', async () => {
      mockReddeSuccess();
      await handler({
        data: {
          items: makeItems(),
          fulfillmentType: 'pickup',
          locationId: 'oak-ridge',
        },
      });
      const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = fetchCall[1].headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer test-redde-key');
    });
  });

  describe('Redde API failure', () => {
    it('sets order status to failed and throws unavailable', async () => {
      mockReddeFailure();
      await expect(
        handler({
          data: {
            items: makeItems(),
            fulfillmentType: 'pickup',
            locationId: 'oak-ridge',
          },
        })
      ).rejects.toMatchObject({ code: 'unavailable' });

      const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
      expect(updateArg.status).toBe('failed');
    });
  });

  describe('missing API key', () => {
    it('sets order to failed and throws internal when REDDE_API_KEY is empty', async () => {
      mockApiKeyRef.value = '';
      await expect(
        handler({
          data: {
            items: makeItems(),
            fulfillmentType: 'pickup',
            locationId: 'oak-ridge',
          },
        })
      ).rejects.toMatchObject({ code: 'internal' });

      const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
      expect(updateArg.status).toBe('failed');
    });
  });
});
