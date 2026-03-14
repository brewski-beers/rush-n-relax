import { beforeEach, describe, expect, it, vi } from 'vitest';

const { submitContactAndQueueEmailMock } = vi.hoisted(() => ({
  submitContactAndQueueEmailMock: vi.fn(),
}));

vi.mock('@/lib/repositories', () => ({
  submitContactAndQueueEmail: submitContactAndQueueEmailMock,
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
});
