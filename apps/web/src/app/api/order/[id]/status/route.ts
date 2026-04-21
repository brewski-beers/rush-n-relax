import { NextResponse } from 'next/server';
import { getOrder } from '@/lib/repositories';

interface Params {
  params: Promise<{ id: string }>;
}

const CACHE_CONTROL = 'private, max-age=10';

/**
 * GET /api/order/[id]/status
 * Lightweight status check used by the client polling island.
 * Returns { status } only — no internal fields exposed.
 *
 * Cache-Control: private, max-age=10 — lets the browser dedupe rapid polls
 * while keeping the response user-scoped (never shared by a CDN).
 */
export async function GET(
  _request: Request,
  { params }: Params
): Promise<NextResponse> {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404, headers: { 'Cache-Control': CACHE_CONTROL } }
    );
  }
  return NextResponse.json(
    { status: order.status },
    { headers: { 'Cache-Control': CACHE_CONTROL } }
  );
}
