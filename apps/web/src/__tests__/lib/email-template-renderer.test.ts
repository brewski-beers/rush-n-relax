import { describe, expect, it } from 'vitest';
import {
  renderEmailSubject,
  renderContactSubmissionEmailHtml,
} from '@/lib/email-template-renderer';
import type { ContactSubmissionPayload, EmailTemplate } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────

function makePayload(
  overrides: Partial<ContactSubmissionPayload> = {}
): ContactSubmissionPayload {
  return {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '6155551234',
    message: 'Hello there!',
    submittedAtIso: '2026-01-01T00:00:00.000Z',
    submissionId: 'sub-123',
    userAgent: 'Mozilla/5.0',
    ...overrides,
  };
}

function makeTheme(): EmailTemplate['theme'] {
  return {
    backgroundColor: '#ffffff',
    panelColor: '#f9f9f9',
    textColor: '#111111',
    mutedTextColor: '#888888',
    accentColor: '#00aa00',
    borderColor: '#dddddd',
    fontFamily: 'sans-serif',
    borderRadiusPx: 8,
  };
}

// ── renderEmailSubject ─────────────────────────────────────────────────────

describe('renderEmailSubject', () => {
  describe('given a subject template with known tokens', () => {
    it('substitutes {{ name }} and {{ email }} from the payload', () => {
      const result = renderEmailSubject(
        { subjectTemplate: 'New inquiry from {{ name }} ({{ email }})' },
        makePayload()
      );
      expect(result).toBe('New inquiry from Jane Doe (jane@example.com)');
    });

    it('substitutes {{ submissionId }} from the payload', () => {
      const result = renderEmailSubject(
        { subjectTemplate: 'Ref: {{ submissionId }}' },
        makePayload()
      );
      expect(result).toBe('Ref: sub-123');
    });
  });

  describe('given a subject template with an unknown token', () => {
    it('replaces the unknown token with an empty string', () => {
      const result = renderEmailSubject(
        { subjectTemplate: 'Hello {{ unknown }} world' },
        makePayload()
      );
      expect(result).toBe('Hello  world');
    });
  });

  describe('given a subject template with no tokens', () => {
    it('returns the template unchanged', () => {
      const result = renderEmailSubject(
        { subjectTemplate: 'Static subject' },
        makePayload()
      );
      expect(result).toBe('Static subject');
    });
  });
});

// ── renderContactSubmissionEmailHtml ───────────────────────────────────────

describe('renderContactSubmissionEmailHtml', () => {
  const theme = makeTheme();

  describe('given a payload with a <script> tag in the message', () => {
    it('escapes the script tag to prevent XSS', () => {
      const payload = makePayload({ message: '<script>alert("xss")</script>' });
      const html = renderContactSubmissionEmailHtml(payload, {
        theme,
        containers: [
          {
            id: 'c1',
            label: 'Body',
            blocks: [{ id: 'b1', type: 'message', label: 'Message' }],
          },
        ],
      });
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('given a keyValue block whose valuePath field is missing from the payload', () => {
    it('renders "N/A" for the missing field', () => {
      // phone is not set (empty string maps to N/A via resolveValue)
      const payload = makePayload({ phone: '' });
      const html = renderContactSubmissionEmailHtml(payload, {
        theme,
        containers: [
          {
            id: 'c1',
            label: 'Body',
            blocks: [
              {
                id: 'b1',
                type: 'keyValue',
                label: 'Phone',
                valuePath: 'phone',
              },
            ],
          },
        ],
      });
      expect(html).toContain('N/A');
    });
  });

  describe('given a heading block', () => {
    it('renders an h2 tag with the block text', () => {
      const html = renderContactSubmissionEmailHtml(makePayload(), {
        theme,
        containers: [
          {
            id: 'c1',
            label: 'Body',
            blocks: [{ id: 'b1', type: 'heading', text: 'Contact Us' }],
          },
        ],
      });
      expect(html).toContain('<h2');
      expect(html).toContain('Contact Us');
    });
  });

  describe('given a paragraph block', () => {
    it('renders a p tag with the block text', () => {
      const html = renderContactSubmissionEmailHtml(makePayload(), {
        theme,
        containers: [
          {
            id: 'c1',
            label: 'Body',
            blocks: [
              {
                id: 'b1',
                type: 'paragraph',
                text: 'Thank you for reaching out.',
              },
            ],
          },
        ],
      });
      expect(html).toContain('<p');
      expect(html).toContain('Thank you for reaching out.');
    });
  });

  describe('given a divider block', () => {
    it('renders an hr element', () => {
      const html = renderContactSubmissionEmailHtml(makePayload(), {
        theme,
        containers: [
          { id: 'c1', label: 'Body', blocks: [{ id: 'b1', type: 'divider' }] },
        ],
      });
      expect(html).toContain('<hr');
    });
  });

  describe('given a spacer block', () => {
    it('renders a div with the specified height', () => {
      const html = renderContactSubmissionEmailHtml(makePayload(), {
        theme,
        containers: [
          {
            id: 'c1',
            label: 'Body',
            blocks: [{ id: 'b1', type: 'spacer', heightPx: 20 }],
          },
        ],
      });
      expect(html).toContain('height:20px');
    });
  });

  describe('given a keyValue block with a present value', () => {
    it('renders the label and the resolved value', () => {
      const html = renderContactSubmissionEmailHtml(makePayload(), {
        theme,
        containers: [
          {
            id: 'c1',
            label: 'Body',
            blocks: [
              {
                id: 'b1',
                type: 'keyValue',
                label: 'Email Address',
                valuePath: 'email',
              },
            ],
          },
        ],
      });
      expect(html).toContain('Email Address');
      expect(html).toContain('jane@example.com');
    });
  });

  describe('given a message block', () => {
    it('renders the payload message inside the block', () => {
      const html = renderContactSubmissionEmailHtml(
        makePayload({ message: 'This is my message.' }),
        {
          theme,
          containers: [
            {
              id: 'c1',
              label: 'Body',
              blocks: [{ id: 'b1', type: 'message', label: 'Your Message' }],
            },
          ],
        }
      );
      expect(html).toContain('This is my message.');
      expect(html).toContain('Your Message');
    });
  });
});

// ── Generic context: nested keys + filters ─────────────────────────────────

import {
  renderEmailHtml,
  renderTemplateString,
} from '@/lib/email-template-renderer';

describe('renderTemplateString — nested keys & filters', () => {
  describe('given a template referencing a nested dot-path', () => {
    it('resolves {{ order.id }} from a nested order object', () => {
      const result = renderTemplateString('Order #{{ order.id }}', {
        order: { id: 'ord_abc' },
      });
      expect(result).toBe('Order #ord_abc');
    });

    it('resolves {{ customer.name }} from a nested customer object', () => {
      const result = renderTemplateString('Hi {{ customer.name }}', {
        customer: { name: 'Jane' },
      });
      expect(result).toBe('Hi Jane');
    });

    it('resolves a deeply nested key', () => {
      const result = renderTemplateString(
        'Ship to {{ deliveryAddress.line1 }}',
        { deliveryAddress: { line1: '123 Oak St' } }
      );
      expect(result).toBe('Ship to 123 Oak St');
    });
  });

  describe('given a token with the | money filter', () => {
    it('formats a numeric value as USD currency', () => {
      const result = renderTemplateString(
        'Total: {{ order.total | money }}',
        { order: { total: 84.5 } }
      );
      expect(result).toContain('$84.50');
    });

    it('returns "N/A" when the value is missing', () => {
      const result = renderTemplateString(
        'Total: {{ order.total | money }}',
        { order: {} }
      );
      expect(result).toBe('Total: N/A');
    });
  });

  describe('given a token with the | date filter', () => {
    it('formats an ISO string as a human-readable date', () => {
      const result = renderTemplateString(
        'Paid {{ order.paidAt | date }}',
        { order: { paidAt: '2026-04-27T12:00:00.000Z' } }
      );
      expect(result).toMatch(/Apr/);
      expect(result).toMatch(/2026/);
    });

    it('returns "N/A" when the value is missing', () => {
      const result = renderTemplateString(
        'Paid {{ order.paidAt | date }}',
        { order: {} }
      );
      expect(result).toBe('Paid N/A');
    });
  });

  describe('given a missing nested key without a filter', () => {
    it('replaces the token with an empty string', () => {
      const result = renderTemplateString('A{{ missing.key }}B', {});
      expect(result).toBe('AB');
    });
  });
});

describe('renderEmailHtml — generic context', () => {
  const theme = {
    backgroundColor: '#ffffff',
    panelColor: '#f9f9f9',
    textColor: '#111111',
    mutedTextColor: '#888888',
    accentColor: '#00aa00',
    borderColor: '#dddddd',
    fontFamily: 'sans-serif',
    borderRadiusPx: 8,
  };

  describe('given a paragraph block referencing nested order tokens', () => {
    it('substitutes the nested values into the rendered paragraph', () => {
      const html = renderEmailHtml(
        {
          theme,
          containers: [
            {
              id: 'c1',
              label: 'Body',
              blocks: [
                {
                  id: 'b1',
                  type: 'paragraph',
                  text: 'Order {{ order.id }} for {{ order.total | money }}',
                },
              ],
            },
          ],
        },
        { order: { id: 'ord_xyz', total: 25 } }
      );
      expect(html).toContain('Order ord_xyz');
      expect(html).toContain('$25.00');
    });
  });

  describe('given a keyValue block whose nested valuePath is missing', () => {
    it('renders "N/A" for the missing nested field', () => {
      const html = renderEmailHtml(
        {
          theme,
          containers: [
            {
              id: 'c1',
              label: 'Body',
              blocks: [
                {
                  id: 'b1',
                  type: 'keyValue',
                  label: 'City',
                  valuePath: 'deliveryAddress.city',
                },
              ],
            },
          ],
        },
        { order: { id: 'x' } }
      );
      expect(html).toContain('N/A');
    });
  });
});
