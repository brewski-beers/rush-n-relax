// Run with: pnpm seed:email-templates:orders
// Seeds the 9 order-lifecycle email templates into the email-templates collection.
// Expects Firestore emulator on :8080 (set FIRESTORE_EMULATOR_HOST).
// Idempotent: upserts by template id via the existing repository helper.
//
// NOTE: copy in this file is engineer-drafted, not copy-agent polished.
// Flag for copy review before launch (see PR for #280).
//
// Tokens reference the OrderEmailPayload shape resolved by the
// email-template-renderer (issue #293). Examples:
//   {{ customer.name }}            — recipient first/full name
//   {{ order.id }}                 — short order id
//   {{ order.total | money }}      — formatted currency
//   {{ order.paidAt | date }}      — formatted date

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

interface ContainersOpts {
  heading: string;
  bodyParagraphs: string[];
  /**
   * Whether to render the delivery-address key/value rows (used by
   * out-for-delivery / completed templates).
   */
  includeDeliveryAddress?: boolean;
  /**
   * Whether to render the order-total row.
   */
  includeOrderTotal?: boolean;
}

function containers(opts: ContainersOpts): EmailTemplateContainer[] {
  const bodyBlocks: EmailTemplateContainer['blocks'] = [
    ...opts.bodyParagraphs.map(text => ({
      id: createId('block'),
      type: 'paragraph' as const,
      text,
    })),
    {
      id: createId('block'),
      type: 'keyValue',
      label: 'Order',
      valuePath: 'order.id',
    },
    {
      id: createId('block'),
      type: 'keyValue',
      label: 'Customer',
      valuePath: 'customer.name',
    },
  ];

  if (opts.includeOrderTotal) {
    bodyBlocks.push({
      id: createId('block'),
      type: 'keyValue',
      label: 'Total',
      // Note: `| money` formatting is applied inline within paragraph
      // tokens; keyValue blocks render the raw value. We surface total
      // here as a number/string — copy/UI may want a money-formatted
      // paragraph instead in the future.
      valuePath: 'order.total',
    });
  }

  if (opts.includeDeliveryAddress) {
    bodyBlocks.push(
      {
        id: createId('block'),
        type: 'keyValue',
        label: 'Address',
        valuePath: 'deliveryAddress.line1',
      },
      {
        id: createId('block'),
        type: 'keyValue',
        label: 'City',
        valuePath: 'deliveryAddress.city',
      }
    );
  }

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
      blocks: bodyBlocks,
    },
    {
      id: createId('container'),
      label: 'Footer',
      blocks: [
        { id: createId('block'), type: 'divider' },
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
  includeDeliveryAddress?: boolean;
  includeOrderTotal?: boolean;
}

const ORDER_TEMPLATES: OrderTemplateSpec[] = [
  {
    id: 'order_received',
    name: 'Order Received',
    subjectTemplate:
      'We got your order, {{ customer.name }} — Rush N Relax #{{ order.id }}',
    heading: 'Thanks for your order',
    body: [
      "We've received your order ({{ order.total | money }}) and it's in the queue.",
      "Next up: we'll verify your ID before charging anything.",
    ],
    includeOrderTotal: true,
  },
  {
    id: 'id_verified',
    name: 'ID Verified',
    subjectTemplate: 'ID verified — finishing your order #{{ order.id }}',
    heading: 'ID verified',
    body: [
      'Your ID checked out. Your payment will be processed shortly.',
      "We'll send another note once it confirms.",
    ],
  },
  {
    id: 'id_rejected',
    name: 'ID Rejected',
    subjectTemplate: "We couldn't verify your ID — order #{{ order.id }}",
    heading: 'We need a clearer ID',
    body: [
      "We weren't able to verify the ID you sent. No charge has been made.",
      'Reply to this email with a clearer photo of your government-issued ID and we will pick it back up.',
    ],
  },
  {
    id: 'payment_confirmed',
    name: 'Payment Confirmed',
    subjectTemplate: 'Payment confirmed — Rush N Relax #{{ order.id }}',
    heading: 'Payment confirmed',
    body: [
      'Your payment of {{ order.total | money }} went through on {{ order.paidAt | date }}. Thanks!',
      "We're packing your order now and will let you know the moment it's on the way.",
    ],
    includeOrderTotal: true,
  },
  {
    id: 'order_preparing',
    name: 'Order Preparing',
    subjectTemplate: 'Your order is being prepared — #{{ order.id }}',
    heading: 'On the bench',
    body: [
      'Our team is putting your order together right now.',
      "Hang tight — you'll get another email when it leaves the shop.",
    ],
  },
  {
    id: 'order_out_for_delivery',
    name: 'Order Out For Delivery',
    subjectTemplate: 'Out for delivery — Rush N Relax #{{ order.id }}',
    heading: 'On the way',
    body: [
      'Your order just left the shop and is heading to {{ deliveryAddress.line1 }}, {{ deliveryAddress.city }}.',
      'Please make sure a 21+ adult is available to sign and show ID at the door.',
    ],
    includeDeliveryAddress: true,
  },
  {
    id: 'order_completed',
    name: 'Order Completed',
    subjectTemplate: 'Delivered — thanks from Rush N Relax #{{ order.id }}',
    heading: 'Delivered',
    body: [
      'Your order has been delivered. Enjoy responsibly.',
      'We appreciate your business — see you next time.',
    ],
  },
  {
    id: 'order_cancelled',
    name: 'Order Cancelled',
    subjectTemplate: 'Order cancelled — #{{ order.id }}',
    heading: 'Order cancelled',
    body: [
      'Your order has been cancelled. If a charge was placed, it will be voided or refunded within a few business days.',
      'Questions? Reply here and we will sort it out.',
    ],
  },
  {
    id: 'order_refunded',
    name: 'Order Refunded',
    subjectTemplate: 'Refund issued — Rush N Relax #{{ order.id }}',
    heading: 'Refund issued',
    body: [
      'A refund of {{ order.total | money }} has been issued for your order. Depending on your bank, it can take 3–7 business days to land back on your card.',
      'If you do not see it after a week, reply here and we will help track it down.',
    ],
    includeOrderTotal: true,
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
        includeDeliveryAddress: spec.includeDeliveryAddress,
        includeOrderTotal: spec.includeOrderTotal,
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
