/**
 * VariantTemplate repository — all Firestore access for variant-template documents.
 * Server-side only (uses firebase-admin).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type { VariantTemplate } from '@/types';
import type { VariantGroup, VariantOption } from '@/types/product';

// ── Collection helpers ────────────────────────────────────────────────────

function variantTemplatesCol() {
  return getAdminFirestore().collection('variant-templates');
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * List all variant templates, ordered by label ascending.
 */
export async function listVariantTemplates(): Promise<VariantTemplate[]> {
  const snap = await variantTemplatesCol().orderBy('label').get();
  return snap.docs.map(doc => docToVariantTemplate(doc.id, doc.data()));
}

// ── Write operations ──────────────────────────────────────────────────────

/**
 * Create or update a variant template document.
 * Upserts by `key` field — queries for an existing doc with matching key,
 * updates if found, creates if not.
 * Returns the doc ID.
 */
export async function upsertVariantTemplate(
  data: Omit<VariantTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = variantTemplatesCol();
  const now = FieldValue.serverTimestamp();

  const existing = await col.where('key', '==', data.key).limit(1).get();

  if (!existing.empty) {
    const docRef = existing.docs[0].ref;
    await docRef.set({ ...data, updatedAt: now }, { merge: true });
    return docRef.id;
  }

  const newDoc = await col.add({
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return newDoc.id;
}

/**
 * Delete a variant template document by ID.
 */
export async function deleteVariantTemplate(id: string): Promise<void> {
  await variantTemplatesCol().doc(id).delete();
}

// ── Private helpers ───────────────────────────────────────────────────────

/**
 * Defensively reconstruct a VariantGroup from a raw Firestore object.
 * Returns a stub group if the data is malformed rather than throwing.
 */
function docToGroup(raw: unknown, fallbackId: string): VariantGroup {
  if (!raw || typeof raw !== 'object') {
    return { groupId: fallbackId, label: '', combinable: false, options: [] };
  }
  const g = raw as Record<string, unknown>;
  const options: VariantOption[] = [];
  if (Array.isArray(g.options)) {
    for (const o of g.options) {
      if (!o || typeof o !== 'object') continue;
      const opt = o as Record<string, unknown>;
      if (typeof opt.optionId === 'string' && typeof opt.label === 'string') {
        options.push({ optionId: opt.optionId, label: opt.label });
      }
    }
  }
  return {
    groupId: typeof g.groupId === 'string' ? g.groupId : fallbackId,
    label: typeof g.label === 'string' ? g.label : '',
    combinable: g.combinable === true,
    options,
  };
}

function docToVariantTemplate(
  id: string,
  data: FirebaseFirestore.DocumentData
): VariantTemplate {
  return {
    id,
    key: data.key as string,
    label: data.label as string,
    group: docToGroup(data.group, id),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } satisfies VariantTemplate;
}
