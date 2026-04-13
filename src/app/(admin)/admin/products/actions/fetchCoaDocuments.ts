'use server';

import { listCoaDocuments } from '@/lib/repositories';
import type { CoaDocument } from '@/types';

/**
 * Server action that lazily fetches COA documents from Storage.
 * Called client-side only on user interaction — never on page load.
 */
export async function fetchCoaDocuments(): Promise<CoaDocument[]> {
  return listCoaDocuments();
}
