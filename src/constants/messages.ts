/**
 * Error Messages
 * Single source of truth for all user-facing error messages
 */
export const ERROR_MESSAGES = {
  // Product errors
  PRODUCT_NOT_FOUND: 'Product not found',
  PRODUCTS_LOAD_FAILED: 'Failed to load products. Please try again.',
  
  // Category errors
  CATEGORY_NOT_FOUND: 'Category not found',
  CATEGORIES_LOAD_FAILED: 'Failed to load categories. Please try again.',
  
  // Network errors
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  
  // Generic errors
  GENERIC_ERROR: 'Something went wrong. Please try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred.',
} as const;

/**
 * Success Messages
 */
export const SUCCESS_MESSAGES = {
  PRODUCT_ADDED_TO_CART: 'Product added to cart',
  ORDER_PLACED: 'Order placed successfully',
} as const;

/**
 * Loading Messages
 */
export const LOADING_MESSAGES = {
  LOADING_PRODUCTS: 'Loading products...',
  LOADING_CATEGORIES: 'Loading categories...',
  LOADING_PRODUCT: 'Loading product details...',
  PROCESSING: 'Processing...',
} as const;

/**
 * Empty State Messages
 */
export const EMPTY_STATE_MESSAGES = {
  NO_PRODUCTS: 'No products available',
  NO_PRODUCTS_IN_CATEGORY: 'No products available in this category',
  NO_SEARCH_RESULTS: 'No products match your search',
  CART_EMPTY: 'Your cart is empty',
} as const;
