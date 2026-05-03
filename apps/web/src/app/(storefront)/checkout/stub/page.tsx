import Link from 'next/link';
import { TestModeBanner } from '@/components/TestModeBanner';

/**
 * Stub payment landing page — shown when Clover sandbox keys are not yet
 * provisioned. Replace the link to a real Clover hosted checkout once
 * sandbox credentials arrive.
 */
export default async function StubCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  return (
    <main className="checkout-stub">
      <TestModeBanner />
      <div className="container">
        <h1>Payment — Stub</h1>
        <p>
          Clover hosted checkout is not yet wired. An order has been recorded as
          <strong> pending</strong>:
        </p>
        <p>
          Order ID: <code>{order ?? 'unknown'}</code>
        </p>
        <p>
          Once Clover sandbox keys are added (<code>CLOVER_MERCHANT_ID</code>,
          <code> CLOVER_API_KEY</code>, <code>CLOVER_WEBHOOK_SECRET</code>),
          this page will redirect to Clover&apos;s hosted payment form.
        </p>
        <Link href="/products" className="btn btn-primary">
          Back to products
        </Link>
      </div>
    </main>
  );
}
