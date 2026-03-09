import type { ContentContext } from '@/types';
import { validateContent } from './validator';

export type RouteHandler = (req: Request) => Promise<Response>;

/**
 * Wraps a Next.js API route handler with server-side compliance validation.
 * Rejects requests with tier-1 violations in the specified content fields.
 * Cannot be bypassed — runs after the client-side UI guard.
 */
export function withComplianceGuard(
  handler: RouteHandler,
  contentFields: Array<{ field: string; context: ContentContext }>
): RouteHandler {
  return async (req: Request): Promise<Response> => {
    let body: Record<string, unknown>;
    try {
      body = (await req.clone().json()) as Record<string, unknown>;
    } catch {
      return handler(req);
    }

    const tier1Violations = contentFields.flatMap(({ field, context }) => {
      const value = body[field];
      if (typeof value !== 'string') return [];
      return validateContent(value, context).violations.filter(
        v => v.tier === 1
      );
    });

    if (tier1Violations.length > 0) {
      return Response.json(
        {
          error: 'Content compliance violation',
          violations: tier1Violations,
        },
        { status: 422 }
      );
    }

    return handler(req);
  };
}
