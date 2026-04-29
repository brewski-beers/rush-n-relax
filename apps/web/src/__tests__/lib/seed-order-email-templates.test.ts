import { describe, expect, it } from 'vitest';
import {
  renderEmailSubject,
  renderEmailHtml,
  type OrderEmailPayload,
} from '@/lib/email-template-renderer';
import {
  ORDER_TEMPLATES,
  RNR_THEME,
  containers,
} from '../../../../../tools/seed-order-email-templates';

const SAMPLE_PAYLOAD: OrderEmailPayload = {
  order: {
    id: 'ord_abc123',
    total: 84.5,
    paidAt: '2026-04-27T12:00:00.000Z',
  },
  customer: {
    name: 'Jane Doe',
    email: 'jane@example.com',
  },
  deliveryAddress: {
    line1: '123 Oak Ridge Dr',
    city: 'Oak Ridge',
    state: 'TN',
    postalCode: '37830',
  },
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
        const html = renderEmailHtml(
          {
            theme: RNR_THEME,
            containers: containers({
              heading: spec.heading,
              bodyParagraphs: spec.body,
              includeDeliveryAddress: spec.includeDeliveryAddress,
              includeOrderTotal: spec.includeOrderTotal,
            }),
          },
          SAMPLE_PAYLOAD
        );
        expect(html.length).toBeGreaterThan(0);
        expect(html).not.toMatch(UNRESOLVED_TOKEN_RE);
      });
    });
  }
});
