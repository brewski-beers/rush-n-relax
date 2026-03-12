/**
 * JsonLd — renders a <script type="application/ld+json"> tag.
 * Schema object must come from a lib/seo/schemas/* factory function.
 * Server Component — no 'use client' needed.
 */
interface JsonLdProps {
  schema: Record<string, unknown>;
}

export function JsonLd({ schema }: JsonLdProps) {
  // JSON.stringify does not escape HTML angle brackets. A product/promo field
  // containing "</script>" would terminate this tag early (XSS). Replacing
  // "</" with "<\/" is the standard mitigation — safe per JSON spec (RFC 8259).
  const json = JSON.stringify(schema).replace(/<\//g, '<\\/');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
