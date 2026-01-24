/**
 * API request/response types for Cloud Functions
 */

import { UserRole, EmployeeStatus, User } from './user.types';
import { Order } from './order.types';

/**
 * User Management API
 */

export interface CreateUserRequest {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  employeeId?: string;
  employeeStatus?: EmployeeStatus;
  transactionAuthority?: boolean;
}

export interface CreateUserResponse {
  success: boolean;
  uid: string;
  message: string;
}

export interface UpdateUserClaimsRequest {
  userId: string;
  role?: UserRole;
  employeeId?: string;
  employeeStatus?: EmployeeStatus;
  transactionAuthority?: boolean;
}

export interface UpdateUserClaimsResponse {
  success: boolean;
  message: string;
}

export interface DeleteUserRequest {
  userId: string;
}

export interface DeleteUserResponse {
  success: boolean;
  message: string;
}

/**
 * Order Management API
 */

export interface CreateOrderRequest {
  customerId: string;
  staffId?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  orderType: 'online' | 'kiosk';
  paymentMethod: string;
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

export interface CreateOrderResponse {
  success: boolean;
  orderId: string;
  order: Order;
}

/**
 * Payment Processing API
 */

export interface ProcessPaymentRequest {
  orderId: string;
  customerId: string;
  staffId?: string;
  amount: number;
  method: 'card' | 'cash' | 'paypal' | 'other';
  transactionId?: string;
}

export interface ProcessPaymentResponse {
  success: boolean;
  paymentId: string;
  status: 'pending' | 'completed' | 'failed';
}
