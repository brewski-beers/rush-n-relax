/**
 * Application Route Paths
 * Single source of truth for all routing paths
 */
export const ROUTES = {
  HOME: '/',
  ACCOUNT: '/account',
  ABOUT: '/about',
  LOCATIONS: '/locations',
  CONTACT: '/contact',
  CATEGORY: '/products/category/:categorySlug',
  PRODUCT: '/products/:categorySlug/:slug',
  ADMIN: '/admin',
  ADMIN_PRODUCTS: '/admin/products',
  ADMIN_CATEGORIES: '/admin/categories',
  ADMIN_ORDERS: '/admin/orders',
} as const;

/**
 * Generate dynamic route paths
 */
export const generatePath = {
  category: (categorySlug: string) => `/products/category/${categorySlug}`,
  product: (categorySlug: string, slug: string) => `/products/${categorySlug}/${slug}`,
  adminProducts: () => '/admin/products',
  adminCategories: () => '/admin/categories',
  adminOrders: () => '/admin/orders',
} as const;
