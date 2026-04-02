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
  /** Cents */
  unitPrice: number;
  /** Cents */
  lineTotal: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  /** Cents */
  subtotal: number;
  /** Cents */
  tax: number;
  /** Cents */
  total: number;
  locationId: string;
  fulfillmentType: FulfillmentType;
  status: OrderStatus;
  reddeTxnId?: string;
  customerEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}
