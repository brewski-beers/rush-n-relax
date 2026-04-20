export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'voided';

export type FulfillmentType = 'pickup' | 'shipping';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  /** cents */
  unitPrice: number;
  /** cents */
  lineTotal: number;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  /** cents */
  subtotal: number;
  /** cents */
  tax: number;
  /** cents */
  total: number;
  locationId: string;
  fulfillmentType: FulfillmentType;
  status: OrderStatus;
  cloverPaymentId?: string;
  customerEmail?: string;
  ageVerificationId?: string;
  shippingAddress?: ShippingAddress;
  createdAt: Date;
  updatedAt: Date;
}
