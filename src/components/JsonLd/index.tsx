/**
 * JsonLd — renders a <script type="application/ld+json"> tag.
 * Schema object must come from a lib/seo/schemas/* factory function.
 * Server Component — no 'use client' needed.
 */
interface JsonLdProps {
  schema: Record<string, unknown>;
}

export function JsonLd({ schema }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
