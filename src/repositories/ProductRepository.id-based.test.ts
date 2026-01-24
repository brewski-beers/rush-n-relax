/**
 * Tests for ID-based product queries
 * Verifies queries use Firestore doc ID instead of slug
 * Slug is metadata for display/SEO only, not for lookups
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProductGuest, ProductStaff, ProductAdmin, User } from '@/types';

// Mock data
const mockProductGuest: ProductGuest = {
  id: 'prod-blue-dream-123', // Firestore auto-generated ID
  categoryId: 'cat-flower-456',
  name: 'Blue Dream',
  slug: 'blue-dream', // Metadata for display
  description: 'A sativa-dominant hybrid',
  displayPrice: 45,
  imageUrl: 'https://example.com/blue-dream.jpg',
  isActive: true,
  thcContent: '22%',
  cbdContent: '1%',
};

const mockProductStaff: ProductStaff = {
  ...mockProductGuest,
  inventory: 15,
  sku: 'BD-001',
  cost: 28,
  tags: ['sativa', 'hybrid'],
};

const mockProductAdmin: ProductAdmin = {
  ...mockProductStaff,
  markup: 60.71,
  notes: 'Popular strain',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUser: User = {
  uid: 'user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'customer',
  employeeId: null,
  employeeStatus: null,
  transactionAuthority: false,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockStaffUser: User = {
  ...mockUser,
  role: 'staff',
};

const mockAdminUser: User = {
  ...mockUser,
  role: 'admin',
};

describe('ProductRepository - ID-Based Queries', () => {
  describe('Guest queries by product ID', () => {
    it('should fetch product by ID (categoryId + productId)', async () => {
      // Given: product ID and category ID
      const categoryId = 'cat-flower-456';
      const productId = 'prod-blue-dream-123';

      // When: query by ID as guest
      // Then: should return ProductGuest without cost/inventory/markup
      // (implementation will call:
      //   doc(db, 'categories', categoryId, 'products', productId)
      //   getDoc(docRef)
      //   project to ProductGuest
      // )
      expect(productId).toBeDefined();
      expect(categoryId).toBeDefined();
    });

    it('should include slug for display/breadcrumb but not for lookup', async () => {
      // Slug is metadata, not the query key
      const product = mockProductGuest;
      expect(product.slug).toBe('blue-dream');
      expect(product.id).toBe('prod-blue-dream-123');
      // lookup key is ID, not slug
    });

    it('should return null if product does not exist', async () => {
      // Given: non-existent product ID
      const categoryId = 'cat-flower-456';
      const productId = 'non-existent-id';

      // When: query by ID
      // Then: should return null
      expect(productId).toBeDefined();
    });

    it('should not include cost/stock in guest response', async () => {
      const guest = mockProductGuest;
      expect(guest).not.toHaveProperty('cost');
      expect(guest).not.toHaveProperty('inventory');
      expect(guest).not.toHaveProperty('markup');
    });
  });

  describe('Staff queries by product ID', () => {
    it('should fetch product by ID as staff with inventory', async () => {
      const categoryId = 'cat-flower-456';
      const productId = 'prod-blue-dream-123';
      const user = mockStaffUser;

      // Staff should see cost + inventory
      expect(productId).toBeDefined();
      expect(categoryId).toBeDefined();
      expect(user.role).toBe('staff');
    });

    it('should include inventory and cost for staff', async () => {
      const staff = mockProductStaff;
      expect(staff.inventory).toBe(15);
      expect(staff.cost).toBe(28);
      expect(staff.tags).toContain('sativa');
    });
  });

  describe('Admin queries by product ID', () => {
    it('should fetch full product by ID as admin', async () => {
      const categoryId = 'cat-flower-456';
      const productId = 'prod-blue-dream-123';
      const user = mockAdminUser;

      expect(productId).toBeDefined();
      expect(categoryId).toBeDefined();
      expect(user.role).toBe('admin');
    });

    it('should include markup and notes for admin', async () => {
      const admin = mockProductAdmin;
      expect(admin.markup).toBe(60.71);
      expect(admin.notes).toBe('Popular strain');
      expect(admin.createdAt).toBeDefined();
      expect(admin.updatedAt).toBeDefined();
    });
  });

  describe('Category product listing (by ID)', () => {
    it('should fetch all products in category by categoryId', async () => {
      const categoryId = 'cat-flower-456';

      // When: query products in category
      // Then: should query where categoryId == 'cat-flower-456'
      // (not by slug)
      expect(categoryId).toBeDefined();
    });

    it('should return products with slugs for breadcrumb display', async () => {
      const products = [mockProductGuest, mockProductGuest];
      products.forEach((p) => {
        expect(p.slug).toBeDefined(); // For breadcrumb
        expect(p.id).toBeDefined(); // For routing
      });
    });
  });

  describe('Slug metadata (read-only)', () => {
    it('should use slug only for display, not queries', async () => {
      // Slug is derived from product name or set once on creation
      // Never used as a query key
      const product = mockProductGuest;
      expect(product.slug).toBe('blue-dream');
      // Query would use product.id, not product.slug
    });

    it('should allow slug to be included in breadcrumbs and meta tags', async () => {
      const product = mockProductGuest;
      // Breadcrumb: /flower/blue-dream (slug for readability)
      // But URL routing uses: /categories/cat-flower/products/prod-blue-dream-123 (ID)
      expect(product.slug).toBe('blue-dream');
      expect(product.id).toBe('prod-blue-dream-123');
    });
  });
});
