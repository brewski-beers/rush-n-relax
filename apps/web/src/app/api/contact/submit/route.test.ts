import { beforeEach, describe, expect, it, vi } from 'vitest';

const { submitContactAndQueueEmailMock, isRateLimitedMock } = vi.hoisted(
  () => ({
    submitContactAndQueueEmailMock: vi.fn(),
    isRateLimitedMock: vi.fn().mockReturnValue(false),
  })
);

vi.mock('@/lib/repositories', () => ({
  submitContactAndQueueEmail: submitContactAndQueueEmailMock,
}));

vi.mock('@/lib/rate-limit', () => ({
  isRateLimited: isRateLimitedMock,
}));

import { POST } from './route';

function createRequest(body: unknown): Request {
  return new Request('http://localhost/api/contact/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('contact submit route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitContactAndQueueEmailMock.mockResolvedValue({
      submissionId: 'submission-1',
      emailJobId: 'job-1',
    });
  });

  it('queues submission when payload is valid', async () => {
    const response = await POST(
      createRequest({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-123-4567',
        message: 'Need assistance with product availability.',
      })
    );
    const json = (await response.json()) as { ok?: boolean };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(submitContactAndQueueEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Jane Doe',
        email: 'jane@example.com',
      })
    );
  });

  it('rejects invalid email', async () => {
    const response = await POST(
      createRequest({
        name: 'Jane Doe',
        email: 'not-an-email',
        message: 'Hello',
      })
    );

    expect(response.status).toBe(400);
    expect(submitContactAndQueueEmailMock).not.toHaveBeenCalled();
  });

  it('returns 400 when name is missing', async () => {
    const response = await POST(
      createRequest({ email: 'jane@example.com', message: 'Hello' })
    );

    expect(response.status).toBe(400);
    expect(submitContactAndQueueEmailMock).not.toHaveBeenCalled();
  });

  it('returns 400 when message is missing', async () => {
    const response = await POST(
      createRequest({ name: 'Jane Doe', email: 'jane@example.com' })
    );

    expect(response.status).toBe(400);
    expect(submitContactAndQueueEmailMock).not.toHaveBeenCalled();
  });

  it('trims oversized name and message to their max lengths', async () => {
    const longName = 'A'.repeat(200);
    const longMessage = 'B'.repeat(6000);

    await POST(
      createRequest({
        name: longName,
        email: 'jane@example.com',
        message: longMessage,
      })
    );

    const [input] = submitContactAndQueueEmailMock.mock.calls[0] as [
      { name: string; message: string },
    ];

    expect(input.name.length).toBe(120);
    expect(input.message.length).toBe(5000);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    isRateLimitedMock.mockReturnValueOnce(true);

    const response = await POST(
      createRequest({
        name: 'Jane Doe',
        email: 'jane@example.com',
        message: 'Hello',
      })
    );

    expect(response.status).toBe(429);
    expect(submitContactAndQueueEmailMock).not.toHaveBeenCalled();
  });
});
