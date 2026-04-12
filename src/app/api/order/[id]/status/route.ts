/**
 * GET /api/order/[id]/status
 * Lightweight polling endpoint for the order confirmation page.
 * Returns only { status } — never exposes internal cost or full order fields.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getOrder } from '@/lib/repositories';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({ status: order.status });
}
