import { NextResponse } from 'next/server';
import { getOrder } from '@/lib/repositories';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/order/[id]/status
 * Lightweight status check used by the client polling island.
 * Returns { status } only — no internal fields exposed.
 */
export async function GET(
  _request: Request,
  { params }: Params
): Promise<NextResponse> {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ status: order.status });
}
