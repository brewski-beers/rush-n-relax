import type { ContentContext } from '@/types';
import { requiredDisclaimers } from './config';

/**
 * Returns any required disclaimers that are missing from the given text.
 * Context determines which disclaimer set to check.
 */
export function checkRequiredDisclaimers(
  text: string,
  context: ContentContext
): string[] {
  const required = getRequiredForContext(context);
  return required.filter(disclaimer => !text.includes(disclaimer));
}

function getRequiredForContext(context: ContentContext): readonly string[] {
  switch (context) {
    case 'product':
      return requiredDisclaimers.productPage;
    case 'seo-title':
    case 'seo-description':
    case 'promo':
    case 'location':
    case 'structured-data':
      return [];
    default:
      return [];
  }
}
