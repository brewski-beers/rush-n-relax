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
  unitPrice: number; // cents
  lineTotal: number; // cents
}

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number; // cents
  tax: number; // cents
  total: number; // cents
  locationId: string;
  fulfillmentType: FulfillmentType;
  status: OrderStatus;
  reddeTxnId?: string;
  customerEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}
