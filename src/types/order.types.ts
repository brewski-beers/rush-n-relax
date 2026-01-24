/**
 * Order, Cart, and Payment Types
 * UID-first schema for ecommerce
 */

export type OrderStatus = 'pending' | 'completed' | 'cancelled';
export type PaymentMethod = 'card' | 'cash' | 'paypal' | 'other';
export type PaymentStatus = 'pending' | 'completed' | 'failed';
export type OrderType = 'online' | 'kiosk';

/**
 * Cart Document (Firestore)
 * Document ID = customer UID
 */
export interface Cart {
  customerId: string;            // Document ID = user UID (PRIMARY KEY)
  items: CartItem[];
  subtotal: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  productId: string;             // FK to products/{id}
  name: string;
  price: number;
  quantity: number;
}

/**
 * Order Document (Firestore)
 * UID-first correlation for customer and staff
 */
export interface Order {
  id: string;
  customerId: string;            // FK to users/{uid} - who receives items
  staffId: string | null;        // FK to users/{uid} - who processed (kiosk only)
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderType: OrderType;          // 'online' | 'kiosk'
  shippingAddress?: ShippingAddress;  // Online orders only
  processedAt: Date | null;      // When staff completed (kiosk only)
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;             // FK to products/{id}
  name: string;
  price: number;
  quantity: number;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/**
 * Payment Document (Firestore)
 * Financial transaction tracking
 */
export interface Payment {
  id: string;
  orderId: string;               // FK to orders/{orderId}
  customerId: string;            // FK to users/{uid}
  staffId: string | null;        // FK to users/{uid}
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
