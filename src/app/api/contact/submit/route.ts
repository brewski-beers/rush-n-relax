import { submitContactAndQueueEmail } from '@/lib/repositories';

interface ContactSubmissionRequest {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export async function POST(request: Request): Promise<Response> {
  let body: ContactSubmissionRequest;

  try {
    const json = (await request.json()) as Partial<ContactSubmissionRequest>;
    body = {
      name: sanitizeText(json.name, 120),
      email: sanitizeText(json.email, 200).toLowerCase(),
      phone: sanitizeText(json.phone ?? '', 40),
      message: sanitizeText(json.message, 5000),
    };
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.name || !body.email || !body.message) {
    return Response.json(
      { error: 'Name, email, and message are required.' },
      { status: 400 }
    );
  }

  if (!EMAIL_PATTERN.test(body.email)) {
    return Response.json({ error: 'Invalid email address.' }, { status: 400 });
  }

  try {
    await submitContactAndQueueEmail({
      ...body,
      ...(body.phone ? { phone: body.phone } : {}),
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[api/contact/submit] failed to queue contact email', error);
    return Response.json(
      { error: 'Failed to submit contact request.' },
      { status: 500 }
    );
  }
}
