import { describe, expect, it } from 'vitest';
import {
  renderEmailSubject,
  renderContactSubmissionEmailHtml,
} from '@/lib/email-template-renderer';
import type { ContactSubmissionPayload } from '@/types';
import {
  ORDER_TEMPLATES,
  RNR_THEME,
  containers,
} from '../../../../../tools/seed-order-email-templates';

const SAMPLE_PAYLOAD: ContactSubmissionPayload = {
  submissionId: 'ord_abc123',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '6155551234',
  // `message` is the only payload field with no resolveValue fallback in
  // the message block; not used here, but required by the type.
  message: 'sample',
  submittedAtIso: '2026-04-27T12:00:00.000Z',
  userAgent: 'test-runner',
};

const UNRESOLVED_TOKEN_RE = /\{\{[^}]*\}\}/;

describe('order lifecycle email templates seed', () => {
  it('contains exactly the 9 expected lifecycle templates', () => {
    expect(ORDER_TEMPLATES).toHaveLength(9);
    expect(ORDER_TEMPLATES.map(t => t.id).sort()).toEqual(
      [
        'id_rejected',
        'id_verified',
        'order_cancelled',
        'order_completed',
        'order_out_for_delivery',
        'order_preparing',
        'order_received',
        'order_refunded',
        'payment_confirmed',
      ].sort()
    );
  });

  for (const spec of ORDER_TEMPLATES) {
    describe(`template: ${spec.id}`, () => {
      it('renders a subject with no unresolved {{...}} placeholders', () => {
        const subject = renderEmailSubject(
          { subjectTemplate: spec.subjectTemplate },
          SAMPLE_PAYLOAD
        );
        expect(subject.length).toBeGreaterThan(0);
        expect(subject).not.toMatch(UNRESOLVED_TOKEN_RE);
      });

      it('renders HTML with no unresolved {{...}} placeholders', () => {
        const html = renderContactSubmissionEmailHtml(SAMPLE_PAYLOAD, {
          theme: RNR_THEME,
          containers: containers({
            heading: spec.heading,
            bodyParagraphs: spec.body,
          }),
        });
        expect(html.length).toBeGreaterThan(0);
        expect(html).not.toMatch(UNRESOLVED_TOKEN_RE);
      });
    });
  }
});
