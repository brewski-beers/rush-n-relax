// Run with: pnpm seed:email-templates:orders
// Seeds the 9 order-lifecycle email templates into the email-templates collection.
// Expects Firestore emulator on :8080 (set FIRESTORE_EMULATOR_HOST).
// Idempotent: upserts by template id via the existing repository helper.
//
// NOTE: copy in this file is engineer-drafted, not copy-agent polished.
// Flag for copy review before launch (see PR for #280).

import { upsertEmailTemplate } from '../apps/web/src/lib/repositories/email-template.repository';
import { createId } from '../apps/web/src/lib/utils/id';
import type {
  EmailTemplate,
  EmailTemplateContainer,
} from '../apps/web/src/types';

process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

const RNR_THEME: EmailTemplate['theme'] = {
  backgroundColor: '#0b1220',
  panelColor: '#111a2b',
  textColor: '#dce3f1',
  accentColor: '#d8c488',
  mutedTextColor: '#8fa6c8',
  borderColor: '#2a3b5f',
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  borderRadiusPx: 14,
};

// Builds a standard 3-container layout: greeting heading + body paragraphs
// + an order-id key/value reference + signoff. The current renderer schema
// only supports ContactSubmissionPayload tokens, so {{ submissionId }} is
// repurposed semantically as the order id. When the renderer is expanded
// with order-aware tokens (future ticket), these blocks remain valid.
function containers(opts: {
  heading: string;
  bodyParagraphs: string[];
}): EmailTemplateContainer[] {
  return [
    {
      id: createId('container'),
      label: 'Header',
      blocks: [
        {
          id: createId('block'),
          type: 'heading',
          text: opts.heading,
        },
      ],
    },
    {
      id: createId('container'),
      label: 'Body',
      blocks: [
        ...opts.bodyParagraphs.map(text => ({
          id: createId('block'),
          type: 'paragraph' as const,
          text,
        })),
        {
          id: createId('block'),
          type: 'keyValue',
          label: 'Order',
          valuePath: 'submissionId',
        },
        {
          id: createId('block'),
          type: 'keyValue',
          label: 'Customer',
          valuePath: 'name',
        },
      ],
    },
    {
      id: createId('container'),
      label: 'Footer',
      blocks: [
        {
          id: createId('block'),
          type: 'divider',
        },
        {
          id: createId('block'),
          type: 'paragraph',
          text: 'Rush N Relax — Oak Ridge · Maryville · Seymour, TN',
        },
        {
          id: createId('block'),
          type: 'paragraph',
          text: 'Questions? Reply to this email and our team will help.',
        },
      ],
    },
  ];
}

interface OrderTemplateSpec {
  id: string;
  name: string;
  subjectTemplate: string;
  heading: string;
  body: string[];
}

const ORDER_TEMPLATES: OrderTemplateSpec[] = [
  {
    id: 'order_received',
    name: 'Order Received',
    subjectTemplate:
      'We got your order, {{ name }} — Rush N Relax #{{ submissionId }}',
    heading: 'Thanks for your order',
    body: [
      "We've received your order and it's in the queue.",
      "Next up: we'll verify your ID before charging anything.",
    ],
  },
  {
    id: 'id_verified',
    name: 'ID Verified',
    subjectTemplate: 'ID verified — finishing your order #{{ submissionId }}',
    heading: 'ID verified',
    body: [
      'Your ID checked out. Your payment will be processed shortly.',
      "We'll send another note once it confirms.",
    ],
  },
  {
    id: 'id_rejected',
    name: 'ID Rejected',
    subjectTemplate: "We couldn't verify your ID — order #{{ submissionId }}",
    heading: 'We need a clearer ID',
    body: [
      "We weren't able to verify the ID you sent. No charge has been made.",
      'Reply to this email with a clearer photo of your government-issued ID and we will pick it back up.',
    ],
  },
  {
    id: 'payment_confirmed',
    name: 'Payment Confirmed',
    subjectTemplate: 'Payment confirmed — Rush N Relax #{{ submissionId }}',
    heading: 'Payment confirmed',
    body: [
      'Your payment went through. Thanks!',
      "We're packing your order now and will let you know the moment it's on the way.",
    ],
  },
  {
    id: 'order_preparing',
    name: 'Order Preparing',
    subjectTemplate: 'Your order is being prepared — #{{ submissionId }}',
    heading: 'On the bench',
    body: [
      'Our team is putting your order together right now.',
      "Hang tight — you'll get another email when it leaves the shop.",
    ],
  },
  {
    id: 'order_out_for_delivery',
    name: 'Order Out For Delivery',
    subjectTemplate: 'Out for delivery — Rush N Relax #{{ submissionId }}',
    heading: 'On the way',
    body: [
      'Your order just left the shop and is heading your way.',
      'Please make sure a 21+ adult is available to sign and show ID at the door.',
    ],
  },
  {
    id: 'order_completed',
    name: 'Order Completed',
    subjectTemplate: 'Delivered — thanks from Rush N Relax #{{ submissionId }}',
    heading: 'Delivered',
    body: [
      'Your order has been delivered. Enjoy responsibly.',
      'We appreciate your business — see you next time.',
    ],
  },
  {
    id: 'order_cancelled',
    name: 'Order Cancelled',
    subjectTemplate: 'Order cancelled — #{{ submissionId }}',
    heading: 'Order cancelled',
    body: [
      'Your order has been cancelled. If a charge was placed, it will be voided or refunded within a few business days.',
      'Questions? Reply here and we will sort it out.',
    ],
  },
  {
    id: 'order_refunded',
    name: 'Order Refunded',
    subjectTemplate: 'Refund issued — Rush N Relax #{{ submissionId }}',
    heading: 'Refund issued',
    body: [
      'A refund has been issued for your order. Depending on your bank, it can take 3–7 business days to land back on your card.',
      'If you do not see it after a week, reply here and we will help track it down.',
    ],
  },
];

async function seed() {
  for (const spec of ORDER_TEMPLATES) {
    await upsertEmailTemplate({
      id: spec.id,
      name: spec.name,
      subjectTemplate: spec.subjectTemplate,
      status: 'published',
      theme: RNR_THEME,
      containers: containers({
        heading: spec.heading,
        bodyParagraphs: spec.body,
      }),
    });
    console.log(`  upserted: email-templates/${spec.id}`);
  }
  console.log(`\nSeeded ${ORDER_TEMPLATES.length} order email templates.`);
}

// Export specs for tests; only run when executed directly via tsx.
export { ORDER_TEMPLATES, RNR_THEME, containers };

const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  /seed-order-email-templates\.ts$/.test(process.argv[1]);

if (isDirectRun) {
  seed().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
