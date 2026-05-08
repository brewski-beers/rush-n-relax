/**
 * Shared helpers for the new checkout-flow E2E specs (issue #373).
 *
 * The flow under test (post-#360..#411 chain):
 *
 *   cart  ── POST /api/checkout/session ──▶ CheckoutSession (awaiting_id)
 *                                            + holds taken on Product.variants
 *      ─▶ /checkout/<sessionId>/verify  (AgeChecker popup or Simulate buttons)
 *      ─▶ AgeChecker webhook  flips status → awaiting_payment + ageVerifiedAt
 *      ─▶ GET /api/checkout/<sessionId>/redirect  (302 → cloverCheckoutUrl)
 *      ─▶ Clover Hosted Checkout (or `/checkout/stub` in dev)
 *      ─▶ GET /order/<sessionId>/return  ─▶ finalizeCheckoutSession()
 *           ─▶ Order created (status=paid) + commitStock + session=completed
 *
 * In dev / preview the live-payments kill switch is OFF, so:
 *   - `createCloverCheckoutSession` returns the local stub redirect URL
 *     (`/checkout/stub?order=<provisional>`)
 *   - `cloverCheckoutSessionId` falls back to the provisional id `cs_xxx`
 *     — which is also the Firestore session doc id.
 *   - `finalizeCheckoutSession` synthesizes a SUCCESS payment outcome.
 *
 * All seed reads/writes go through the Firestore emulator REST API to avoid
 * spinning up the Admin SDK in the test runner — the same pattern used by
 * `apps/web/e2e/products-pagination.spec.ts`.
 */
import type { Page, APIRequestContext } from '@playwright/test';

const EMULATOR_FIRESTORE = 'http://127.0.0.1:8080';
const PROJECT_ID = 'rush-n-relax';
const CART_STORAGE_KEY = 'rnr_cart_v2';
const ONLINE_LOCATION_ID = 'online';

// ── Seed shape (unified Product.variants per #308 / #354) ──────────────────

export interface SeedVariantInput {
  /** Variant id — used as the key in `Product.variants` and the cart line. */
  variantId: string;
  /** Visible label (e.g. "1g", "Default"). */
  label: string;
  /** cents */
  price: number;
  /** Stock to write on `variants[variantId].locations.online.qty`. */
  qty: number;
  /** Already-reserved stock (defaults to 0). */
  reserved?: number;
}

export interface SeedProductInput {
  slug: string;
  name: string;
  variants: SeedVariantInput[];
}

/**
 * Build a Firestore-REST `mapValue` body for the unified `variants` map.
 * Mirrors `Product.variants[variantId] = { label, locations: { online: {...} } }`.
 */
function variantsMapValue(variants: SeedVariantInput[]) {
  const fields: Record<string, unknown> = {};
  for (const v of variants) {
    fields[v.variantId] = {
      mapValue: {
        fields: {
          label: { stringValue: v.label },
          locations: {
            mapValue: {
              fields: {
                [ONLINE_LOCATION_ID]: {
                  mapValue: {
                    fields: {
                      qty: { integerValue: String(v.qty) },
                      price: { integerValue: String(v.price) },
                      reserved: { integerValue: String(v.reserved ?? 0) },
                      availablePickup: { booleanValue: false },
                      featured: { booleanValue: false },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  }
  return { mapValue: { fields } };
}

/**
 * Seed a product with the unified `variants` map directly into the
 * Firestore emulator. The doc carries an `inStockAt` denorm so the
 * storefront grid surfaces it (matches #312 schema).
 */
export async function seedProductWithVariants(
  product: SeedProductInput
): Promise<void> {
  const url = `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/products/${product.slug}`;
  const inStock = product.variants.some(v => v.qty - (v.reserved ?? 0) > 0);
  const body = JSON.stringify({
    fields: {
      slug: { stringValue: product.slug },
      name: { stringValue: product.name },
      category: { stringValue: 'flower' },
      details: { stringValue: 'Seeded for checkout-flow E2E (#373).' },
      status: { stringValue: 'active' },
      availableAt: {
        arrayValue: { values: [{ stringValue: ONLINE_LOCATION_ID }] },
      },
      inStockAt: {
        arrayValue: inStock
          ? { values: [{ stringValue: ONLINE_LOCATION_ID }] }
          : { values: [] },
      },
      variants: variantsMapValue(product.variants),
    },
  });
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner',
    },
    body,
  });
  if (!res.ok) {
    throw new Error(
      `Failed to seed product ${product.slug}: ${res.status} ${await res.text()}`
    );
  }
}

// ── Cart preload + delivery form ───────────────────────────────────────────

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
  email: 'e2e-checkout@example.com',
};

interface CartLine {
  productId: string;
  variantId: string;
  variantLabel: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

/**
 * Pre-populate the cart via localStorage so we don't have to drive the
 * full PDP UI. Schema mirrors `CartItem` (rnr_cart_v2).
 */
export async function preloadCart(
  page: Page,
  product: SeedProductInput,
  variantIndex = 0,
  quantity = 1
): Promise<void> {
  const v = product.variants[variantIndex];
  const items: CartLine[] = [
    {
      productId: product.slug,
      variantId: v.variantId,
      variantLabel: v.label,
      name: product.name,
      unitPrice: v.price,
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

/** Fill `<DeliveryDetailsForm>` by visible labels — resilient to class renames. */
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

// ── Firestore REST read/patch helpers ──────────────────────────────────────

/**
 * Read a CheckoutSession doc straight from the emulator. Returns the raw
 * Firestore `fields` map (string-tagged values).
 */
export async function fetchCheckoutSessionFields(
  sessionId: string
): Promise<Record<string, unknown>> {
  const url = `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/checkout-sessions/${sessionId}`;
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer owner' },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch session ${sessionId}: ${res.status} ${await res.text()}`
    );
  }
  const doc = (await res.json()) as { fields?: Record<string, unknown> };
  return doc.fields ?? {};
}

/**
 * Read a Product doc — used to assert post-commit qty / reserved decrements.
 */
export async function fetchProductFields(
  slug: string
): Promise<Record<string, unknown>> {
  const url = `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/products/${slug}`;
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer owner' },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch product ${slug}: ${res.status} ${await res.text()}`
    );
  }
  const doc = (await res.json()) as { fields?: Record<string, unknown> };
  return doc.fields ?? {};
}

/**
 * Pull `qty` / `reserved` for a (slug, variantId, locationId) triple out
 * of a Product doc's nested REST `fields` shape. Returns null when any
 * intermediate node is missing.
 */
export function readVariantLocation(
  productFields: Record<string, unknown>,
  variantId: string,
  locationId = ONLINE_LOCATION_ID
): { qty: number; reserved: number } | null {
  type MV = { mapValue?: { fields?: Record<string, unknown> } };
  type IV = { integerValue?: string };
  const variants = (productFields.variants as MV | undefined)?.mapValue?.fields;
  const variant = (variants?.[variantId] as MV | undefined)?.mapValue?.fields;
  const locations = (variant?.locations as MV | undefined)?.mapValue?.fields;
  const loc = (locations?.[locationId] as MV | undefined)?.mapValue?.fields;
  if (!loc) return null;
  return {
    qty: Number((loc.qty as IV | undefined)?.integerValue ?? '0'),
    reserved: Number((loc.reserved as IV | undefined)?.integerValue ?? '0'),
  };
}

/**
 * Force-set `ageVerifiedAt` + `verificationId` + `status=awaiting_payment`
 * on a CheckoutSession doc to simulate the AgeChecker webhook landing
 * (used by webhook-race scenarios). Uses an `updateMask` so we only touch
 * the three fields and don't clobber the rest of the doc.
 */
export async function simulateAgeCheckerWebhookPass(
  sessionId: string
): Promise<void> {
  const url =
    `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/checkout-sessions/${sessionId}` +
    `?updateMask.fieldPaths=ageVerifiedAt&updateMask.fieldPaths=verificationId&updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`;
  const body = JSON.stringify({
    fields: {
      ageVerifiedAt: { timestampValue: new Date().toISOString() },
      verificationId: { stringValue: 'e2e-webhook-sim' },
      status: { stringValue: 'awaiting_payment' },
      updatedAt: { timestampValue: new Date().toISOString() },
    },
  });
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner',
    },
    body,
  });
  if (!res.ok) {
    throw new Error(
      `Simulate webhook failed for ${sessionId}: ${res.status} ${await res.text()}`
    );
  }
}

// ── Direct API drivers ─────────────────────────────────────────────────────

interface CreateSessionResponse {
  sessionId?: string;
  redirectUrl?: string;
  error?: string;
  productId?: string;
  available?: number;
  requested?: number;
}

/**
 * POST /api/checkout/session directly with a one-line cart. Used by tests
 * that don't need to drive the cart UI (e.g. shortage 409, race scenarios).
 */
export async function createCheckoutSessionViaApi(
  request: APIRequestContext,
  baseURL: string,
  product: SeedProductInput,
  variantIndex = 0,
  quantity = 1
): Promise<{ status: number; body: CreateSessionResponse }> {
  const v = product.variants[variantIndex];
  const subtotal = v.price * quantity;
  const tax = Math.round(subtotal * 0.0925);
  const total = subtotal + tax;
  const res = await request.post(`${baseURL}/api/checkout/session`, {
    headers: { 'content-type': 'application/json' },
    data: {
      items: [
        {
          productId: product.slug,
          variantId: v.variantId,
          productName: product.name,
          quantity,
          unitPrice: v.price,
          lineTotal: v.price * quantity,
        },
      ],
      subtotal,
      tax,
      total,
      locationId: ONLINE_LOCATION_ID,
      deliveryAddress: {
        name: DEFAULT_DELIVERY.name,
        line1: DEFAULT_DELIVERY.line1,
        city: DEFAULT_DELIVERY.city,
        state: DEFAULT_DELIVERY.state,
        zip: DEFAULT_DELIVERY.zip,
      },
      customerEmail: DEFAULT_DELIVERY.email,
    },
  });
  return {
    status: res.status(),
    body: (await res.json().catch(() => ({}))) as CreateSessionResponse,
  };
}

// ── REST value extractors (Firestore JSON → primitives) ────────────────────

export function strField(
  fields: Record<string, unknown>,
  key: string
): string | undefined {
  return (fields[key] as { stringValue?: string } | undefined)?.stringValue;
}
