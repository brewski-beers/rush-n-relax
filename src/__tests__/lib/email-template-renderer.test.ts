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
