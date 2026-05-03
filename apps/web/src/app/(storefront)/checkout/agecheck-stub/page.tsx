import Link from 'next/link';

/**
 * Stub age-verification landing page — shown when AgeChecker.Net keys
 * (`AGECHECKER_API_KEY`, `AGECHECKER_MERCHANT_ID`) are not yet provisioned.
 *
 * The agechecker stub helper at `apps/web/src/lib/agechecker.ts` returns
 * `/checkout/agecheck-stub?order=<id>` as the redirect URL when env vars are
 * absent. This page renders a friendly placeholder + a way to simulate the
 * pass/deny callbacks during Preview testing so the order lifecycle can be
 * driven end-to-end without a real AgeChecker account.
 *
 * In production with real keys configured, the helper will return the real
 * AgeChecker hosted-verification URL instead and this page will not be
 * reached.
 */
export default async function AgeCheckStubPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  const orderId = order ?? 'unknown';

  return (
    <main className="checkout-stub">
      <div className="container">
        <h1>Age Verification — Stub</h1>
        <p>
          AgeChecker.Net is not yet wired. An order has been recorded as
          <strong> pending_id_verification</strong>:
        </p>
        <p>
          Order ID: <code>{orderId}</code>
        </p>
        <p>
          Once AgeChecker keys are added (<code>AGECHECKER_API_KEY</code>,{' '}
          <code>AGECHECKER_MERCHANT_ID</code>), this page will redirect to
          AgeChecker&apos;s hosted verification flow. Until then, the order is
          parked in <code>pending_id_verification</code> until a webhook is
          delivered to <code>/api/webhooks/agechecker</code>.
        </p>
        <p>
          To resume from here, either fire a webhook (sandbox testing) or visit
          your order page to monitor status.
        </p>
        <p>
          <Link href={`/order/${orderId}`} className="btn btn-primary">
            View order
          </Link>{' '}
          <Link href="/products" className="btn">
            Back to products
          </Link>
        </p>
      </div>
    </main>
  );
}
