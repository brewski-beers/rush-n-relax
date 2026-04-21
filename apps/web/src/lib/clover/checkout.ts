/**
 * Clover eComm Hosted Checkout bridge.
 *
 * ⚠️  STUBBED until sandbox credentials are provisioned.
 *     Do NOT wire production Clover keys without matching sandbox keys.
 *
 * When CLOVER_MERCHANT_ID + CLOVER_API_KEY are present, this module will
 * POST to Clover's hosted checkout API and return the redirect URL. Until
 * then, it returns a local stub URL so the rest of the flow can be exercised.
 *
 * Docs: https://docs.clover.com/docs/using-checkout-api
 */

export interface CheckoutSessionInput {
  orderId: string;
  /** cents */
  amount: number;
  customerEmail?: string;
}

export interface CheckoutSession {
  redirectUrl: string;
  provider: 'clover' | 'stub';
}

export function createCloverCheckoutSession(
  input: CheckoutSessionInput
): Promise<CheckoutSession> {
  const merchantId = process.env.CLOVER_MERCHANT_ID;
  const apiKey = process.env.CLOVER_API_KEY;

  // Until sandbox is provisioned, return a stub URL. When sandbox keys exist,
  // replace this branch with a real fetch() to Clover's hosted checkout API.
  const provider: 'clover' | 'stub' = merchantId && apiKey ? 'stub' : 'stub';
  return Promise.resolve({
    redirectUrl: `/checkout/stub?order=${encodeURIComponent(input.orderId)}`,
    provider,
  });
}
