/**
 * Category Document (Firestore)
 * Stored in categories/{categoryId}
 */
export interface Category {
  id: string;                    // Firestore document ID
  name: string;                  // Display name (e.g., "Flower")
  slug: string;                  // URL-friendly (e.g., "flower")
  description: string;           // Short description for cards
  imageUrl: string;              // Category hero image
  order: number;                 // Display order (1, 2, 3, 4)
  isActive: boolean;             // Hide/show category
  seoTitle?: string;             // SEO meta title
  seoDescription?: string;       // SEO meta description
  createdAt: Date;               // Audit trail
  updatedAt: Date;               // Last modified
}

/**
 * Product Document (Firestore)
 * Stored in products/{productId}
 * Contains all fields - projection happens at repository layer
 */
export interface Product {
  id: string;                    // Firestore document ID
  categoryId: string;            // Reference to categories/{categoryId}
  name: string;                  // Product name
  slug: string;                  // URL-friendly identifier
  description?: string;          // Product description
  displayPrice: number;          // Customer-facing price
  cost: number;                  // Internal cost (admin only)
  markup: number;                // Markup percentage (admin only)
  imageUrl?: string;             // Product image
  stock: number;                 // Available quantity (staff+admin only)
  stockThreshold: number;        // Low stock alert level (staff+admin only)
  locationId: string;            // Store location
  thcContent?: string;           // THC percentage (e.g., "22%")
  cbdContent?: string;           // CBD percentage (e.g., "1%")
  isActive: boolean;             // Published/draft status (admin only)
  tags?: string[];               // Internal tags (staff+admin only)
  notes?: string;                // Internal notes (admin only)
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Role-Based Product Schemas
 * Projected at repository layer to enforce data visibility
 */

/**
 * Guest Product - Public facing, no sensitive data
 * What unauthenticated users see
 */
export interface ProductGuest {
  id: string;
  categoryId: string;
  name: string;
  slug: string;                  // URL-friendly identifier
  description?: string;
  displayPrice: number;          // ✅ Customer price
  imageUrl?: string;
  isActive: boolean;             // Hide inactive products
  thcContent?: string;
  cbdContent?: string;
}

/**
 * Staff Product - POS system, includes cost/stock
 * What staff members see (POS, inventory management)
 */
export interface ProductStaff extends ProductGuest {
  stock: number;                 // ✅ Inventory
  stockThreshold: number;        // ✅ Low stock alerts
  cost: number;                  // ✅ Cost for margin calculations
  tags?: string[];               // ✅ Product categorization
  locationId: string;
}

/**
 * Admin Product - Full schema with all fields
 * What admins see (configuration, reporting, analytics)
 */
export interface ProductAdmin extends ProductStaff {
  markup: number;                // ✅ Markup percentage
  notes?: string;                // ✅ Internal notes
  isActive: boolean;             // ✅ Publishing controls
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Client-side type with category metadata joined
 * Used in UI components after lookup
 */
export interface ProductWithCategory extends Product {
  category: Category;            // Full category object
}

/**
 * Union type for role-based products
 * TypeScript ensures only correct schema is passed to components
 */
export type AnyProduct = ProductGuest | ProductStaff | ProductAdmin;

/**
 * Authentication & User Types
 */

export type UserRole = 'admin' | 'manager' | 'staff' | 'customer' | 'guest';

export type UserStatus = 'invited' | 'registered' | 'deprecated';

export interface User {
  id: string;                    // Firebase UID
  email: string;
  displayName?: string;
  role: UserRole;
  status?: UserStatus;           // Lifecycle status
  contactMethod?: 'email' | 'phone';
  contactVerified?: boolean;
  authUid?: string;              // Link to Auth account when available
  locationId?: string;           // Store location (manager+staff+admin)
  invitedBy?: string;            // UID of who invited them
  invitedAt?: Date;
  acceptedAt?: Date;             // When they first signed in after invite
  createdBy?: string;            // Who created doc (e.g., staff registering guest)
  lastActiveAt?: Date;           // Presence approximation
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
}

/**
 * Permission system types
 */
export interface Permission {
  resource: 'products' | 'categories' | 'orders' | 'users';
  action: 'read' | 'create' | 'update' | 'delete';
  scope?: 'guest' | 'staff' | 'admin';  // Visibility level
}

export const RolePermissions: Record<UserRole, Permission[]> = {
  guest: [
    { resource: 'products', action: 'read', scope: 'guest' },
    { resource: 'categories', action: 'read', scope: 'guest' },
  ],
  customer: [
    { resource: 'products', action: 'read', scope: 'guest' },
    { resource: 'categories', action: 'read', scope: 'guest' },
    { resource: 'orders', action: 'read' },
    { resource: 'orders', action: 'create' },
  ],
  staff: [
    { resource: 'products', action: 'read', scope: 'staff' },
    { resource: 'categories', action: 'read', scope: 'staff' },
    { resource: 'orders', action: 'read' },
    { resource: 'orders', action: 'update' },
  ],
  manager: [
    { resource: 'products', action: 'read', scope: 'admin' },
    { resource: 'products', action: 'create' },
    { resource: 'products', action: 'update' },
    { resource: 'categories', action: 'read', scope: 'admin' },
    { resource: 'categories', action: 'create' },
    { resource: 'categories', action: 'update' },
    { resource: 'orders', action: 'read' },
    { resource: 'users', action: 'read' },
    { resource: 'users', action: 'update' },
  ],
  admin: [
    { resource: 'products', action: 'read', scope: 'admin' },
    { resource: 'products', action: 'create' },
    { resource: 'products', action: 'update' },
    { resource: 'products', action: 'delete' },
    { resource: 'categories', action: 'read', scope: 'admin' },
    { resource: 'categories', action: 'create' },
    { resource: 'categories', action: 'update' },
    { resource: 'categories', action: 'delete' },
    { resource: 'orders', action: 'read' },
    { resource: 'orders', action: 'update' },
    { resource: 'users', action: 'read' },
    { resource: 'users', action: 'create' },
    { resource: 'users', action: 'update' },
    { resource: 'users', action: 'delete' },
  ],
};

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
