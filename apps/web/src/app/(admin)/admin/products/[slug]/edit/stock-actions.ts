'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { setVariantLocation, getProductBySlug } from '@/lib/repositories';
import type { ProductVariantLocation } from '@/types/product';

/**
 * Result returned by {@link setProductVariantStock}.
 *
 * Issue #311: surfaces variantSpecs writes inside the unified product editor.
 * Replaces the per-location `/admin/inventory/{locationId}` page (which is
 * being deprecated and redirected to `/admin/products`).
 */
export type SetProductVariantStockResult =
  | { ok: true }
  | { ok: false; error: string };

interface PatchInput {
  qty: number;
  price: number;
  compareAtPrice?: number;
  availablePickup?: boolean;
  featured?: boolean;
}

/**
 * Update a single (variant, location) entry on a product.
 *
 * Owner-only. Rejects featured=true when qty<=0 (same invariant as the
 * legacy inventory editor). Forces availablePickup/featured=false when
 * qty=0 to keep denormalized index arrays consistent.
 */
export async function setProductVariantStock(
  slug: string,
  variantId: string,
  locationId: string,
  patch: PatchInput
): Promise<SetProductVariantStockResult> {
  const actor = await requireRole('owner');

  const product = await getProductBySlug(slug);
  if (!product) {
    return { ok: false, error: `Product '${slug}' not found.` };
  }

  const variant = product.variantSpecs?.[variantId];
  if (!variant) {
    return {
      ok: false,
      error: `Variant '${variantId}' not found on product '${slug}'.`,
    };
  }

  const qty = Math.max(0, Math.floor(patch.qty));
  const price = Math.max(0, Math.floor(patch.price));
  const inStock = qty > 0;

  if (patch.featured === true && !inStock) {
    return { ok: false, error: 'Cannot feature an item that is not in stock.' };
  }

  const next: ProductVariantLocation = {
    qty,
    price,
    ...(patch.compareAtPrice !== undefined &&
      Number.isFinite(patch.compareAtPrice) && {
        compareAtPrice: Math.max(0, Math.floor(patch.compareAtPrice)),
      }),
    ...(patch.availablePickup !== undefined && {
      availablePickup: inStock ? patch.availablePickup : false,
    }),
    ...(patch.featured !== undefined && {
      featured: inStock ? patch.featured : false,
    }),
  };

  try {
    await setVariantLocation(slug, variantId, locationId, next, {
      source: 'admin',
      actor: actor.email,
      reason: 'product-editor',
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update stock.',
    };
  }

  revalidatePath(`/admin/products/${slug}/edit`);
  revalidatePath('/admin/products');
  revalidatePath('/');
  revalidatePath('/products');
  revalidatePath(`/products/${slug}`);

  return { ok: true };
}

/**
 * Rename a variant on a product. KISS: reads the product, mutates the
 * variantSpecs map's `label`, and writes back via setVariantLocation on
 * an existing location entry (which carries the recompute side-effect).
 *
 * No locations? Returns ok:false — variant must have at least one
 * location to be renamable through this surface. The full add/remove
 * variant flow is owned by the catalog editor (variantGroups).
 */
export async function renameProductVariant(
  slug: string,
  variantId: string,
  nextLabel: string
): Promise<SetProductVariantStockResult> {
  await requireRole('owner');

  const trimmed = nextLabel.trim();
  if (!trimmed) {
    return { ok: false, error: 'Variant label cannot be empty.' };
  }
  // Defer to the catalog editor (variantGroups) for the actual rename to
  // keep the rename codepath single-source. Surfaced here as a friendly
  // error so the inline editor can route users correctly.
  return {
    ok: false,
    error:
      'Variant labels are managed in the Variants section. Update the variant group there and save.',
  };
}
