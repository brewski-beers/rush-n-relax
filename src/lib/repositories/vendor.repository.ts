/**
 * Vendor repository — stub.
 * Full implementation pending vendor management feature.
 */
import type { VendorSummary } from '@/types/vendor';

export function listAllVendors(): Promise<VendorSummary[]> {
  return Promise.resolve([]);
}

export function listVendors(): Promise<VendorSummary[]> {
  return Promise.resolve([]);
}

export function getVendorBySlug(_slug: string): Promise<VendorSummary | null> {
  return Promise.resolve(null);
}

export function upsertVendor(
  _data: Omit<VendorSummary, 'slug'> & { slug: string }
): Promise<string> {
  return Promise.reject(new Error('Vendor management not yet implemented.'));
}

export function setVendorActive(
  _slug: string,
  _active: boolean
): Promise<void> {
  return Promise.reject(new Error('Vendor management not yet implemented.'));
}
