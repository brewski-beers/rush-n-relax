export type ProductCategory = 'flower' | 'edibles' | 'vapes' | 'accessories';

export interface Category {
  id: ProductCategory;
  name: string;
  description: string;
  imageUrl: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  locationId: string;
  imageUrl?: string;
  category: ProductCategory;
  thcContent?: string;
  cbdContent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'card' | 'cash' | 'store-credit';
  locationId: string;
  customerId?: string;
  staffId?: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface UserRole {
  uid: string;
  email: string;
  role: 'customer' | 'staff' | 'admin' | 'super-admin';
  locationId?: string;
}
