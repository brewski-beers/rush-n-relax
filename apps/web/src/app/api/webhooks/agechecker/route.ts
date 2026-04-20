import { NextRequest, NextResponse } from 'next/server';
import { verifyAgeCheckerSignature } from '@/lib/agechecker';

/**
 * AgeChecker webhook handler.
 *
 * In production, verifies HMAC signature with AGECHECKER_SECRET.
 * In test mode (AGECHECKER_TEST_MODE=true), signature check is bypassed.
 *
 * The client-side widget returns the outcome directly to the browser, but
 * AgeChecker also fires a server-to-server webhook which we use as the
 * authoritative source of truth. Treat client outcome as hint, webhook as
 * commit.
 */

interface AgeCheckerEvent {
  verificationId: string;
  status: string;
  email?: string;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-agechecker-signature');

  if (!verifyAgeCheckerSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: AgeCheckerEvent;
  try {
    event = JSON.parse(rawBody) as AgeCheckerEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // The authoritative verification record. Currently we only log —
  // the checkout session endpoint accepts the client verificationId directly.
  // When we need stronger guarantees, persist these to Firestore and
  // validate against this store at checkout time.
  console.warn('[agechecker] verified', {
    verificationId: event.verificationId,
    status: event.status,
  });

  return NextResponse.json({ received: true });
}
