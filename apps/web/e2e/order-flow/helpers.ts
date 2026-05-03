/**
 * Shared helpers for the order-flow E2E specs (issue #285).
 *
 * The flow under test:
 *   1. cart with 1+ items, delivery address in a shippable state, valid email
 *   2. "Verify Age" button → AgeCheckerModal (test mode renders simulate buttons)
 *   3. simulate Pass → POST /api/order/start → order created in `id_verified`
 *   4. redirect to /order/[id] → poller calls /api/checkout/session
 *   5. stub returns /checkout/stub?order=<id> → page redirects there
 *   6. simulate Clover webhook (HMAC-signed POST) → status transitions
 *   7. /order/[id] reflects the new status (paid / failed)
 *
 * The whole flow runs against the Firebase emulators with stubbed providers.
 * No real network calls leave localhost.
 */
import { Page, APIRequestContext, expect } from '@playwright/test';
import crypto from 'node:crypto';

const EMULATOR_FIRESTORE = 'http://127.0.0.1:8080';
const PROJECT_ID = 'rush-n-relax';
const CART_STORAGE_KEY = 'rnr_cart_v2';

/**
 * Must mirror the secret set on the dev server's CLOVER_WEBHOOK_SECRET env
 * (see playwright.config.ts webServer.env). The webhook handler verifies
 * HMAC-SHA256 of the raw body using this secret.
 */
export const E2E_CLOVER_WEBHOOK_SECRET =
  process.env.CLOVER_WEBHOOK_SECRET ?? 'e2e-clover-secret';

export interface SeedProductInput {
  slug: string;
  name: string;
  unitPrice: number; // cents
  /** Stock to write to inventory/online/items/{slug}. */
  stock: number;
}

/**
 * Writes a product doc + an `online` inventory doc directly into the Firestore
 * emulator via REST. Avoids spinning up the Admin SDK in the test runner
 * (per project memory: emulator REST is the supported pattern).
 */
export async function seedProductForOrderFlow(
  product: SeedProductInput
): Promise<void> {
  const productUrl = `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/products/${product.slug}`;
  const productBody = JSON.stringify({
    fields: {
      slug: { stringValue: product.slug },
      name: { stringValue: product.name },
      category: { stringValue: 'flower' },
      details: { stringValue: 'Seeded for order-flow E2E (issue #285).' },
      status: { stringValue: 'active' },
      basePrice: { integerValue: String(product.unitPrice) },
      availableAt: {
        arrayValue: { values: [{ stringValue: 'online' }] },
      },
    },
  });
  const productRes = await fetch(productUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner',
    },
    body: productBody,
  });
  if (!productRes.ok) {
    throw new Error(
      `Failed to seed product ${product.slug}: ${productRes.status} ${await productRes.text()}`
    );
  }

  const inventoryUrl = `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/inventory/online/items/${product.slug}`;
  const inventoryBody = JSON.stringify({
    fields: {
      productId: { stringValue: product.slug },
      locationId: { stringValue: 'online' },
      quantity: { integerValue: String(product.stock) },
      status: { stringValue: 'in_stock' },
    },
  });
  const invRes = await fetch(inventoryUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner',
    },
    body: inventoryBody,
  });
  if (!invRes.ok) {
    throw new Error(
      `Failed to seed inventory for ${product.slug}: ${invRes.status} ${await invRes.text()}`
    );
  }
}

/**
 * Pre-populate the cart via localStorage so we don't have to drive the full
 * product-detail UI. Must run BEFORE the cart page navigation.
 *
 * Schema mirrors `CartItem` in src/contexts/CartContext.tsx (rnr_cart_v2).
 */
export async function preloadCart(
  page: Page,
  product: SeedProductInput,
  quantity = 1
): Promise<void> {
  const items = [
    {
      productId: product.slug,
      variantId: 'default',
      variantLabel: 'Default',
      name: product.name,
      unitPrice: product.unitPrice,
      quantity,
    },
  ];
  await page.addInitScript(
    ([key, payload]) => {
      window.localStorage.setItem(key, payload);
    },
    [CART_STORAGE_KEY, JSON.stringify(items)] as const
  );
}

export interface DeliveryFixture {
  name: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  email: string;
}

export const DEFAULT_DELIVERY: DeliveryFixture = {
  name: 'E2E Customer',
  line1: '123 Test St',
  city: 'Knoxville',
  state: 'TN',
  zip: '37902',
  email: 'e2e-order@example.com',
};

/**
 * Fill the DeliveryDetailsForm. Field selectors mirror the live form;
 * we look them up by visible label to stay resilient to class renames.
 */
export async function fillDeliveryDetails(
  page: Page,
  fixture: DeliveryFixture = DEFAULT_DELIVERY
): Promise<void> {
  await page.getByLabel(/full name/i).fill(fixture.name);
  await page.getByLabel(/street address/i).fill(fixture.line1);
  await page.getByLabel(/city/i).fill(fixture.city);
  await page.getByLabel(/state/i).selectOption(fixture.state);
  await page.getByLabel(/zip/i).fill(fixture.zip);
  await page.getByLabel(/email/i).fill(fixture.email);
}

/**
 * Sign a webhook body with the same HMAC the route validates against.
 */
export function signCloverWebhook(rawBody: string): string {
  return crypto
    .createHmac('sha256', E2E_CLOVER_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
}

/**
 * Drive a Clover webhook event directly — bypassing the cart UI for the
 * "what happens after payment" leg. Uses Playwright's APIRequestContext so
 * the call originates from the same process and respects the dev-server
 * baseURL.
 */
export async function postCloverWebhook(
  request: APIRequestContext,
  baseURL: string,
  event: { type: string; data: { orderId: string; paymentId?: string } }
): Promise<void> {
  const rawBody = JSON.stringify(event);
  const signature = signCloverWebhook(rawBody);
  const res = await request.post(`${baseURL}/api/webhooks/clover`, {
    headers: {
      'content-type': 'application/json',
      'x-clover-signature': signature,
    },
    data: rawBody,
  });
  expect(res.status(), 'webhook should be accepted').toBe(200);
}

/**
 * Read an order doc straight from the emulator REST API. Returns the raw
 * Firestore JSON `fields` map. Used to assert testMode + final status without
 * needing the Admin SDK in the test runner.
 */
export async function fetchOrderFields(
  orderId: string
): Promise<Record<string, unknown>> {
  const url = `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/orders/${orderId}`;
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer owner' },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch order ${orderId}: ${res.status} ${await res.text()}`
    );
  }
  const doc = (await res.json()) as { fields?: Record<string, unknown> };
  return doc.fields ?? {};
}

/**
 * Pull the orderId out of the URL after the cart redirects. The cart calls
 * `window.location.assign('/order/<id>')` on a successful POST.
 */
export function orderIdFromUrl(url: string): string | null {
  const m = url.match(/\/order\/([^/?#]+)/);
  return m ? m[1] : null;
}
