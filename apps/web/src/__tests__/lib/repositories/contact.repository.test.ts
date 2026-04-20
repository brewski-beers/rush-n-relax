import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  setMock,
  batchSetMock,
  batchCommitMock,
  collectionMock,
  getAdminFirestoreMock,
  getEmailTemplateByIdMock,
} = vi.hoisted(() => {
  const setMock = vi.fn().mockResolvedValue(undefined);
  const batchSetMock = vi.fn();
  const batchCommitMock = vi.fn().mockResolvedValue(undefined);
  const getEmailTemplateByIdMock = vi.fn().mockResolvedValue({
    id: 'contact-submission-default',
    subjectTemplate: 'New contact submission from {{name}}',
    theme: {
      backgroundColor: '#0b1220',
      panelColor: '#111a2b',
      textColor: '#dce3f1',
      accentColor: '#d8c488',
      mutedTextColor: '#8fa6c8',
      borderColor: '#2a3b5f',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      borderRadiusPx: 14,
    },
    containers: [],
  });

  const batchMock = {
    set: batchSetMock,
    commit: batchCommitMock,
  };

  const collectionMock = vi.fn((collectionName: string) => ({
    doc: vi.fn((name?: string) => {
      if (collectionName === 'contact-submissions' && !name) {
        return {
          id: 'submission-123',
          set: setMock,
        };
      }

      if (collectionName === 'outbound-emails' && !name) {
        return {
          id: 'job-123',
          set: setMock,
        };
      }

      return {
        id: name ?? 'generated-doc-id',
        set: setMock,
      };
    }),
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
    batch: vi.fn(() => batchMock),
  }));

  return {
    setMock,
    batchSetMock,
    batchCommitMock,
    collectionMock,
    getAdminFirestoreMock,
    getEmailTemplateByIdMock,
  };
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: getAdminFirestoreMock,
  toDate: (value: Date | string) => new Date(value),
}));

vi.mock('@/lib/repositories/email-template.repository', () => ({
  getEmailTemplateById: getEmailTemplateByIdMock,
}));

vi.mock('@/lib/email-template-renderer', () => ({
  renderEmailSubject: vi.fn(
    (_template, payload: { name: string }) =>
      `Rendered subject for ${payload.name}`
  ),
  renderContactSubmissionEmailHtml: vi.fn(
    (_payload, _template) => '<div>Rendered email HTML</div>'
  ),
}));

import { queueTestContactEmail } from '@/lib/repositories/contact.repository';
import { submitContactAndQueueEmail } from '@/lib/repositories/contact.repository';
import { requeueOutboundEmailJob } from '@/lib/repositories/contact.repository';

describe('contact.repository queueing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not write undefined fields in queued test email jobs', async () => {
    const jobId = await queueTestContactEmail({ to: 'qa@example.com' });

    expect(jobId).toBe('job-123');
    expect(getAdminFirestoreMock).toHaveBeenCalled();
    expect(collectionMock).toHaveBeenCalledWith('outbound-emails');
    expect(setMock).toHaveBeenCalledTimes(1);

    const [payload] = setMock.mock.calls[0] as [Record<string, unknown>];

    expect(payload.lastAttemptAt).toBeUndefined();
    expect(payload.html).toBe('<div>Rendered email HTML</div>');
    expect(Object.prototype.hasOwnProperty.call(payload, 'lastAttemptAt')).toBe(
      false
    );
  });

  it('requeueOutboundEmailJob calls set with queued status, null errorMessage, nextAttemptAt, and updatedAt', async () => {
    await requeueOutboundEmailJob('job-abc');

    expect(collectionMock).toHaveBeenCalledWith('outbound-emails');
    expect(setMock).toHaveBeenCalledTimes(1);

    const [payload, options] = setMock.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];

    expect(payload.status).toBe('queued');
    expect(payload.errorMessage).toBeNull();
    expect(payload.nextAttemptAt).toBeInstanceOf(Date);
    expect(payload.updatedAt).toBeInstanceOf(Date);
    expect(options).toEqual({ merge: true });
  });

  it('does not write undefined fields in batched contact queue jobs', async () => {
    const result = await submitContactAndQueueEmail({
      name: 'Jane Doe',
      email: 'jane@example.com',
      message: 'Hello from the contact form',
    });

    expect(result).toEqual({
      submissionId: 'submission-123',
      emailJobId: 'job-123',
    });

    expect(batchSetMock).toHaveBeenCalledTimes(2);
    expect(batchCommitMock).toHaveBeenCalledTimes(1);

    const [, outboundPayload] = batchSetMock.mock.calls[1] as [
      unknown,
      Record<string, unknown>,
    ];

    expect(outboundPayload.lastAttemptAt).toBeUndefined();
    expect(outboundPayload.html).toBe('<div>Rendered email HTML</div>');
    expect(
      Object.prototype.hasOwnProperty.call(outboundPayload, 'lastAttemptAt')
    ).toBe(false);
  });
});
