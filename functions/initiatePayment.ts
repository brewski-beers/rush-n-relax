/**
 * initiatePayment — Cloud Function (v2 callable)
 *
 * Creates an order document, then calls the Redde Payments API to initiate
 * a hosted payment transaction. Returns { orderId, paymentUrl } to the client.
 *
 * Depends on:
 *   - #63 Redde API docs  (TODO fields marked below)
 *   - #64 orders repository (types defined inline here, matching order.ts)
 *
 * Firebase Secret required: REDDE_API_KEY
 *   firebase functions:secrets:set REDDE_API_KEY
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';

const REDDE_API_KEY = defineSecret('REDDE_API_KEY');

// TODO(#63): Confirm base URL from Redde developer portal.
const REDDE_BASE_URL = 'https://api.reddedashboard.com/v1';
const REDDE_INITIATE_PATH = '/transactions/initiate';
const FETCH_TIMEOUT_MS = 15_000;
// Flat TN tax placeholder — real tax computed server-side.
const TAX_RATE = 0.0925;

// ── Domain types (mirror src/types/order.ts from #64) ────────────────────────

type OrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'voided';

type FulfillmentType = 'pickup' | 'shipping';

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  /** Unit price in cents. */
  unitPrice: number;
}

export interface InitiatePaymentRequest {
  items: CartItem[];
  fulfillmentType: FulfillmentType;
  locationId: string;
  customerEmail?: string;
}

export interface InitiatePaymentResponse {
  orderId: string;
  paymentUrl: string;
}

// ── Redde API types ──────────────────────────────────────────────────────────

interface ReddeInitiatePayload {
  // TODO(#63): Confirm exact field names and whether amount is cents or dollars.
  amount: number;
  currency: string;
  orderId: string;
  description: string;
  customerEmail?: string;
  callbackUrl: string;
  successUrl: string;
  cancelUrl: string;
}

interface ReddeInitiateResponse {
  // TODO(#63): Confirm txnId and paymentUrl field names.
  txnId: string;
  paymentUrl: string;
  status: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

function calcTax(subtotal: number): number {
  return Math.round(subtotal * TAX_RATE);
}

async function createOrderDoc(params: {
  items: CartItem[];
  fulfillmentType: FulfillmentType;
  locationId: string;
  customerEmail: string | undefined;
  subtotal: number;
  tax: number;
  total: number;
}): Promise<string> {
  const db = getFirestore();
  const now = new Date();
  const docRef = db.collection('orders').doc();
  await docRef.set({
    items: params.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.unitPrice * item.quantity,
    })),
    subtotal: params.subtotal,
    tax: params.tax,
    total: params.total,
    locationId: params.locationId,
    fulfillmentType: params.fulfillmentType,
    status: 'pending' as OrderStatus,
    customerEmail: params.customerEmail ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

async function patchOrderStatus(
  orderId: string,
  status: OrderStatus,
  reddeTxnId?: string
): Promise<void> {
  const db = getFirestore();
  const patch: Record<string, unknown> = { status, updatedAt: new Date() };
  if (reddeTxnId !== undefined) {
    patch.reddeTxnId = reddeTxnId;
  }
  await db.collection('orders').doc(orderId).update(patch);
}

async function callReddeInitiate(
  apiKey: string,
  payload: ReddeInitiatePayload
): Promise<ReddeInitiateResponse> {
  const url = `${REDDE_BASE_URL}${REDDE_INITIATE_PATH}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      // TODO(#63): Confirm auth header name (Bearer vs custom header).
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const json = (await response.json()) as Partial<ReddeInitiateResponse> & {
    message?: string;
  };

  if (!response.ok || !json.txnId || !json.paymentUrl) {
    throw new Error(
      json.message ?? `Redde API error (HTTP ${response.status})`
    );
  }

  return json as ReddeInitiateResponse;
}

// ── Exported Cloud Function ───────────────────────────────────────────────────

export const initiatePayment = onCall<
  InitiatePaymentRequest,
  Promise<InitiatePaymentResponse>
>(
  {
    secrets: [REDDE_API_KEY],
    region: 'us-central1',
  },
  async request => {
    const { items, fulfillmentType, locationId, customerEmail } = request.data;

    // ── Validate ──────────────────────────────────────────────────────────
    if (!Array.isArray(items) || items.length === 0) {
      throw new HttpsError(
        'invalid-argument',
        'items must be a non-empty array'
      );
    }

    for (const item of items) {
      if (
        typeof item.productId !== 'string' ||
        typeof item.productName !== 'string' ||
        typeof item.quantity !== 'number' ||
        item.quantity < 1 ||
        typeof item.unitPrice !== 'number' ||
        item.unitPrice <= 0
      ) {
        throw new HttpsError(
          'invalid-argument',
          'Each item must have productId, productName, quantity >= 1, and unitPrice > 0'
        );
      }
    }

    if (fulfillmentType !== 'pickup' && fulfillmentType !== 'shipping') {
      throw new HttpsError(
        'invalid-argument',
        'fulfillmentType must be "pickup" or "shipping"'
      );
    }

    if (typeof locationId !== 'string' || !locationId) {
      throw new HttpsError('invalid-argument', 'locationId is required');
    }

    // ── Compute totals ────────────────────────────────────────────────────
    const subtotal = calcSubtotal(items);
    const tax = calcTax(subtotal);
    const total = subtotal + tax;

    // ── Create order BEFORE calling Redde (ensures record on API failure) ─
    let orderId: string;
    try {
      orderId = await createOrderDoc({
        items,
        fulfillmentType,
        locationId,
        customerEmail,
        subtotal,
        tax,
        total,
      });
    } catch (err) {
      logger.error('[initiatePayment] Failed to create order doc', { err });
      throw new HttpsError('internal', 'Failed to create order');
    }

    const apiKey = REDDE_API_KEY.value();
    if (!apiKey) {
      logger.error('[initiatePayment] REDDE_API_KEY is not set');
      await patchOrderStatus(orderId, 'failed');
      throw new HttpsError('internal', 'Payment service not configured');
    }

    // ── Call Redde API ────────────────────────────────────────────────────
    // TODO(#63): Adjust successUrl / cancelUrl if base domain changes.
    const appBaseUrl = process.env.APP_BASE_URL ?? 'https://rush-n-relax.com';
    const payload: ReddeInitiatePayload = {
      amount: total, // TODO(#63): Confirm cents vs dollars with Redde docs
      currency: 'USD',
      orderId,
      description: 'Rush N Relax order',
      callbackUrl: `${appBaseUrl}/api/redde/webhook`,
      successUrl: `${appBaseUrl}/order/${orderId}`,
      cancelUrl: `${appBaseUrl}/cart`,
      ...(customerEmail ? { customerEmail } : {}),
    };

    try {
      const reddeResponse = await callReddeInitiate(apiKey, payload);
      await patchOrderStatus(orderId, 'pending', reddeResponse.txnId);
      logger.info('[initiatePayment] Transaction initiated', {
        orderId,
        reddeTxnId: reddeResponse.txnId,
      });
      return { orderId, paymentUrl: reddeResponse.paymentUrl };
    } catch (err) {
      logger.error('[initiatePayment] Redde API call failed', { orderId, err });
      await patchOrderStatus(orderId, 'failed');
      throw new HttpsError(
        'unavailable',
        'Payment initiation failed. Please try again.'
      );
    }
  }
);
