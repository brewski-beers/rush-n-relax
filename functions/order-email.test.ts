import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────

const {
  triggerHandlerRef,
  mockApiKeyRef,
  mockTemplateDoc,
  mockJobRef,
  mockJobSet,
} = vi.hoisted(() => {
  return {
    triggerHandlerRef: {
      handler: null as null | ((event: unknown) => Promise<void>),
    },
    mockApiKeyRef: { value: 'test-resend-key' },
    mockTemplateDoc: {
      exists: true,
      data: () => ({
        id: 'payment_confirmed',
        name: 'Payment Confirmed',
        subjectTemplate: 'Payment received for order {{ order.id }}',
        theme: {
          backgroundColor: '#000',
          panelColor: '#111',
          textColor: '#fff',
          accentColor: '#d8c488',
          mutedTextColor: '#888',
          borderColor: '#333',
          fontFamily: 'sans-serif',
          borderRadiusPx: 12,
        },
        containers: [
          {
            id: 'main',
            label: 'Main',
            blocks: [
              { id: 'h', type: 'heading', text: 'Order paid' },
              {
                id: 'p',
                type: 'paragraph',
                text: 'Hi {{ customer.name }}, total: {{ order.total | money }}',
              },
              {
                id: 'kv',
                type: 'keyValue',
                label: 'Order',
                valuePath: 'order.id',
              },
            ],
          },
        ],
      }),
    },
    mockJobRef: {
      id: 'job-123',
      set: vi.fn().mockResolvedValue(undefined),
    },
    mockJobSet: vi.fn(),
  };
});

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: vi.fn(() => ({})),
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: vi.fn(
    (_config: unknown, handler: (event: unknown) => Promise<void>) => {
      triggerHandlerRef.handler = handler;
      return {};
    }
  ),
}));

vi.mock('firebase-functions/params', () => ({
  defineSecret: vi.fn(() => ({ value: () => mockApiKeyRef.value })),
}));

vi.mock('firebase-functions/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('firebase-admin/app', () => ({ initializeApp: vi.fn() }));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue(mockTemplateDoc),
      })),
    })),
  })),
}));

// Trigger module load (registers the handler)
import './index';

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeOrderJobSnapshot(data: unknown) {
  return {
    data: {
      id: 'job-123',
      ref: mockJobRef,
      data: () => data,
    },
  };
}

function stubResendOk() {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'resend-msg-1' }),
    } as Response)
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('outbound-emails trigger — order job branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiKeyRef.value = 'test-resend-key';
    mockJobRef.set.mockClear();
    mockJobRef.set.mockResolvedValue(undefined);
    mockTemplateDoc.exists = true;
  });

  it('registers a Firestore onDocumentCreated handler at module load', () => {
    expect(triggerHandlerRef.handler).not.toBeNull();
  });

  it('processes an order email job (templateId + vars + status:pending) end-to-end', async () => {
    const fetchSpy = stubResendOk();
    vi.stubGlobal('fetch', fetchSpy);

    const event = makeOrderJobSnapshot({
      to: 'kb@example.com',
      templateId: 'payment_confirmed',
      vars: {
        order: { id: 'ord-42', total: 125.5, status: 'paid' },
        customer: { name: 'KB', email: 'kb@example.com' },
        deliveryAddress: null,
      },
      status: 'pending',
    });

    await triggerHandlerRef.handler!(event);

    // Resend was called with rendered subject + html
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.to).toEqual(['kb@example.com']);
    expect(body.subject).toBe('Payment received for order ord-42');
    expect(body.html).toContain('KB');
    expect(body.html).toContain('$125.50');
    expect(body.html).toContain('ord-42');

    // Job was marked sent
    const sentCall = mockJobRef.set.mock.calls.find(
      c => (c[0] as { status?: string }).status === 'sent'
    );
    expect(sentCall).toBeDefined();
    expect(
      (sentCall![0] as { providerMessageId?: string }).providerMessageId
    ).toBe('resend-msg-1');
  });

  it('marks the job failed when the template is missing', async () => {
    mockTemplateDoc.exists = false;
    vi.stubGlobal('fetch', stubResendOk());

    const event = makeOrderJobSnapshot({
      to: 'kb@example.com',
      templateId: 'nope',
      vars: { order: { id: 'x' }, customer: { email: 'kb@example.com' } },
      status: 'pending',
    });

    await triggerHandlerRef.handler!(event);

    const failedCall = mockJobRef.set.mock.calls.find(
      c => (c[0] as { status?: string }).status === 'failed'
    );
    expect(failedCall).toBeDefined();
    expect(
      (failedCall![0] as { errorMessage?: string }).errorMessage
    ).toContain("'nope'");
  });

  it('marks the job failed when Resend rejects the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          json: () => Promise.resolve({ message: 'invalid recipient' }),
        } as Response)
      )
    );

    const event = makeOrderJobSnapshot({
      to: 'bad@example.com',
      templateId: 'payment_confirmed',
      vars: { order: { id: 'ord-x' }, customer: { email: 'bad@example.com' } },
      status: 'pending',
    });

    await triggerHandlerRef.handler!(event);

    const failedCall = mockJobRef.set.mock.calls.find(
      c => (c[0] as { status?: string }).status === 'failed'
    );
    expect(failedCall).toBeDefined();
  });

  it('ignores docs that match neither contact-submission nor order shape', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const event = makeOrderJobSnapshot({
      // Has templateId but no `vars` and no `to` → not a valid order job
      templateId: 'payment_confirmed',
      status: 'pending',
    });

    await triggerHandlerRef.handler!(event);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockJobRef.set).not.toHaveBeenCalled();
  });

  it('ignores order jobs already in a terminal status (status !== pending)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const event = makeOrderJobSnapshot({
      to: 'kb@example.com',
      templateId: 'payment_confirmed',
      vars: { order: { id: 'x' }, customer: { email: 'kb@example.com' } },
      status: 'sent',
    });

    await triggerHandlerRef.handler!(event);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockJobRef.set).not.toHaveBeenCalled();
  });

  it('still handles legacy contact-submission jobs (no regression)', async () => {
    const fetchSpy = stubResendOk();
    vi.stubGlobal('fetch', fetchSpy);

    const event = makeOrderJobSnapshot({
      type: 'contact-submission',
      status: 'queued',
      templateId: 'contact-submission-default',
      subject: 'New contact submission from KB',
      from: 'Rush N Relax <no-reply@rushnrelax.com>',
      to: ['hello@rushnrelax.com'],
      payload: {
        submissionId: 'sub-1',
        name: 'KB',
        email: 'kb@example.com',
        message: 'Hello',
        submittedAtIso: new Date().toISOString(),
      },
      attemptCount: 0,
      maxAttempts: 5,
    });

    await triggerHandlerRef.handler!(event);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.subject).toContain('contact submission');
  });

  it('marks order job failed when RESEND_API_KEY is missing', async () => {
    mockApiKeyRef.value = '';
    vi.stubGlobal('fetch', vi.fn());

    const event = makeOrderJobSnapshot({
      to: 'kb@example.com',
      templateId: 'payment_confirmed',
      vars: { order: { id: 'x' }, customer: { email: 'kb@example.com' } },
      status: 'pending',
    });

    await triggerHandlerRef.handler!(event);

    expect(global.fetch).not.toHaveBeenCalled();
    const failedCall = mockJobRef.set.mock.calls.find(
      c => (c[0] as { status?: string }).status === 'failed'
    );
    expect(failedCall).toBeDefined();
  });
});
