/**
 * Refund-pending repository (#406).
 *
 * Queue of failed Clover refunds awaiting retry by the reconciler cron.
 * Documents are keyed by the Clover `paymentId` so the same payment can
 * never be enqueued twice — repeated failures simply update the row.
 *
 * Server-side only via Admin SDK. The collection is fully locked down by
 * Firestore rules; only the storefront `finalizeCheckoutSession` (write)
 * and the reconciler Cloud Function (read/update/delete) touch it.
 */
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';

const COLLECTION = 'refunds-pending';

export type RefundPendingSource = 'finalize' | 'reconciler' | 'manual';

export interface RefundPendingRecord {
  /** Clover paymentId — also the Firestore doc id. */
  cloverPaymentId: string;
  orderId: string;
  sessionId: string;
  /** First time the refund failed. */
  attemptedAt: Date;
  /** Most recent retry attempt. */
  lastAttemptedAt: Date;
  /** Number of failed retries (0 on first enqueue). */
  retryCount: number;
  /** Truncated message of the most recent error. */
  lastError: string;
  createdBy: RefundPendingSource;
}

export interface EnqueueRefundPendingInput {
  cloverPaymentId: string;
  orderId: string;
  sessionId: string;
  error: string;
  createdBy?: RefundPendingSource;
}

const MAX_ERROR_LEN = 500;

function refundsPendingCol() {
  return getAdminFirestore().collection(COLLECTION);
}

function truncate(s: string): string {
  return s.length > MAX_ERROR_LEN ? s.slice(0, MAX_ERROR_LEN) : s;
}

/**
 * Enqueue (or refresh) a failed-refund row. Idempotent on `cloverPaymentId`:
 * if the row already exists, `attemptedAt` and `createdBy` are preserved
 * while `lastError` and `lastAttemptedAt` are refreshed.
 */
export async function enqueueRefundPending(
  input: EnqueueRefundPendingInput
): Promise<void> {
  if (!input.cloverPaymentId) {
    throw new Error('cloverPaymentId is required');
  }
  const ref = refundsPendingCol().doc(input.cloverPaymentId);
  const now = new Date();
  const lastError = truncate(input.error);
  const createdBy: RefundPendingSource = input.createdBy ?? 'finalize';

  await getAdminFirestore().runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      tx.update(ref, {
        lastError,
        lastAttemptedAt: now,
      });
      return;
    }
    const payload: Omit<RefundPendingRecord, never> = {
      cloverPaymentId: input.cloverPaymentId,
      orderId: input.orderId,
      sessionId: input.sessionId,
      attemptedAt: now,
      lastAttemptedAt: now,
      retryCount: 0,
      lastError,
      createdBy,
    };
    tx.set(ref, payload);
  });
}

export interface ListRefundsPendingForRetryOptions {
  maxRetries: number;
  now: Date;
  /** Hard cap to keep cron tick cheap. */
  limit?: number;
}

/**
 * Return rows that are eligible for a retry: `retryCount < maxRetries` AND
 * exponential-backoff window elapsed.
 *
 * Backoff: row is retryable when `lastAttemptedAt + 2^retryCount minutes
 * <= now`. retryCount=0 → 1m, 1 → 2m, 2 → 4m, 3 → 8m, 4 → 16m.
 *
 * The Firestore query filters by `retryCount`; the backoff check is
 * applied in-memory because Firestore cannot compose a date arithmetic
 * predicate against a stored timestamp.
 */
export async function listRefundsPendingForRetry(
  opts: ListRefundsPendingForRetryOptions
): Promise<RefundPendingRecord[]> {
  const limit = opts.limit ?? 100;
  const snap = await refundsPendingCol()
    .where('retryCount', '<', opts.maxRetries)
    .orderBy('retryCount', 'asc')
    .limit(limit)
    .get();

  const out: RefundPendingRecord[] = [];
  for (const doc of snap.docs) {
    const rec = docToRefundPending(doc.id, doc.data());
    if (isEligibleForRetry(rec, opts.now)) {
      out.push(rec);
    }
  }
  return out;
}

export function backoffMsFor(retryCount: number): number {
  const minutes = 2 ** Math.max(0, retryCount);
  return minutes * 60 * 1000;
}

function isEligibleForRetry(rec: RefundPendingRecord, now: Date): boolean {
  const earliest = rec.lastAttemptedAt.getTime() + backoffMsFor(rec.retryCount);
  return earliest <= now.getTime();
}

/**
 * Increment retryCount + record the latest error after a failed retry.
 */
export async function markRefundPendingRetryFailed(
  cloverPaymentId: string,
  error: string
): Promise<void> {
  const ref = refundsPendingCol().doc(cloverPaymentId);
  const now = new Date();
  const lastError = truncate(error);
  await getAdminFirestore().runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data() ?? {};
    const prev = typeof data.retryCount === 'number' ? data.retryCount : 0;
    tx.update(ref, {
      retryCount: prev + 1,
      lastAttemptedAt: now,
      lastError,
    });
  });
}

/**
 * Remove the queue row after a successful retry.
 */
export async function deleteRefundPending(
  cloverPaymentId: string
): Promise<void> {
  await refundsPendingCol().doc(cloverPaymentId).delete();
}

function docToRefundPending(
  id: string,
  d: FirebaseFirestore.DocumentData
): RefundPendingRecord {
  return {
    cloverPaymentId:
      typeof d.cloverPaymentId === 'string' ? d.cloverPaymentId : id,
    orderId: typeof d.orderId === 'string' ? d.orderId : '',
    sessionId: typeof d.sessionId === 'string' ? d.sessionId : '',
    attemptedAt: toDate(d.attemptedAt),
    lastAttemptedAt: toDate(d.lastAttemptedAt),
    retryCount: typeof d.retryCount === 'number' ? d.retryCount : 0,
    lastError: typeof d.lastError === 'string' ? d.lastError : '',
    createdBy:
      d.createdBy === 'reconciler' || d.createdBy === 'manual'
        ? d.createdBy
        : 'finalize',
  } satisfies RefundPendingRecord;
}
