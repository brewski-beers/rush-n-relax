/**
 * Seed products script
 * Pure data definition + utility functions
 * No Firebase logic - uses seedDataAdmin for all operations
 */

import 'dotenv/config';
import { seedProductsAdmin } from '../src/lib/seedDataAdmin';
import { adminDb } from '../src/lib/firebaseAdminServer';
import type { ProductAdmin } from '../src/types';

const PRODUCTS: Omit<ProductAdmin, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Flower products
  {
    categoryId: 'flower',
    name: 'Blue Dream',
    slug: 'blue-dream',
    description: 'A sativa-dominant hybrid with balanced effects',
    displayPrice: 45,
    cost: 28,
    imageUrl:
      'https://images.unsplash.com/photo-1597733336794-12d05021d510?w=400&h=300&fit=crop',
    stock: 15,
    stockThreshold: 5,
    thcContent: '22%',
    cbdContent: '1%',
    isActive: true,
    tags: ['hybrid', 'sativa', 'balanced'],
    notes: 'Popular strain, consistent quality',
    markup: 60.71,
    locationId: 'default',
  },
  {
    categoryId: 'flower',
    name: 'OG Kush',
    slug: 'og-kush',
    description: 'Classic indica with earthy, pine flavors',
    displayPrice: 50,
    cost: 32,
    imageUrl:
      'https://images.unsplash.com/photo-1597733336794-12d05021d510?w=400&h=300&fit=crop',
    stock: 8,
    stockThreshold: 5,
    thcContent: '24%',
    cbdContent: '0.5%',
    isActive: true,
    tags: ['indica', 'classic', 'earthy'],
    notes: 'Limited stock, reorder soon',
    markup: 56.25,
    locationId: 'default',
  },
  {
    categoryId: 'flower',
    name: 'Girl Scout Cookies',
    slug: 'girl-scout-cookies',
    description: 'Sweet and earthy hybrid with strong effects',
    displayPrice: 55,
    cost: 35,
    imageUrl:
      'https://images.unsplash.com/photo-1597733336794-12d05021d510?w=400&h=300&fit=crop',
    stock: 12,
    stockThreshold: 5,
    thcContent: '26%',
    cbdContent: '0.3%',
    isActive: true,
    tags: ['hybrid', 'sweet', 'potent'],
    notes: 'Premium strain, high demand',
    markup: 57.14,
    locationId: 'default',
  },

  // Edibles
  {
    categoryId: 'edibles',
    name: 'Gummy Bears (10mg)',
    slug: 'gummy-bears-10mg',
    description: 'Fruit-flavored gummies, 10mg THC each',
    displayPrice: 20,
    cost: 8,
    imageUrl:
      'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=400&h=300&fit=crop',
    stock: 30,
    stockThreshold: 10,
    thcContent: '10mg per piece',
    cbdContent: '0%',
    isActive: true,
    tags: ['gummies', 'fruit', 'beginner-friendly'],
    notes: 'Best seller, restock frequently',
    markup: 150,
    locationId: 'default',
  },
  {
    categoryId: 'edibles',
    name: 'Chocolate Bars (5mg)',
    slug: 'chocolate-bars-5mg',
    description: 'Dark chocolate infused with 5mg THC',
    displayPrice: 15,
    cost: 6,
    imageUrl:
      'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=400&h=300&fit=crop',
    stock: 45,
    stockThreshold: 15,
    thcContent: '5mg per bar',
    cbdContent: '0%',
    isActive: true,
    tags: ['chocolate', 'microdose', 'popular'],
    notes: 'High margin product',
    markup: 150,
    locationId: 'default',
  },
  {
    categoryId: 'edibles',
    name: 'Peanut Butter Cups (20mg)',
    slug: 'peanut-butter-cups-20mg',
    description: 'Creamy peanut butter with dark chocolate coating',
    displayPrice: 25,
    cost: 10,
    imageUrl:
      'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=400&h=300&fit=crop',
    stock: 20,
    stockThreshold: 8,
    thcContent: '20mg per cup',
    cbdContent: '0%',
    isActive: true,
    tags: ['peanut-butter', 'chocolate', 'premium'],
    notes: 'Premium edible, steady demand',
    markup: 150,
    locationId: 'default',
  },

  // Vapes
  {
    categoryId: 'vapes',
    name: 'Sativa Cartridge',
    slug: 'sativa-cartridge',
    description: 'Energizing sativa blend, 1g cartridge',
    displayPrice: 35,
    cost: 18,
    imageUrl:
      'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400&h=300&fit=crop',
    stock: 20,
    stockThreshold: 5,
    thcContent: '85%',
    cbdContent: '0%',
    isActive: true,
    tags: ['cartridge', 'sativa', 'concentrate'],
    notes: 'Popular morning option',
    markup: 94.44,
    locationId: 'default',
  },
  {
    categoryId: 'vapes',
    name: 'Indica Cartridge',
    slug: 'indica-cartridge',
    description: 'Relaxing indica blend, 1g cartridge',
    displayPrice: 35,
    cost: 18,
    imageUrl:
      'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400&h=300&fit=crop',
    stock: 25,
    stockThreshold: 5,
    thcContent: '87%',
    cbdContent: '0%',
    isActive: true,
    tags: ['cartridge', 'indica', 'concentrate'],
    notes: 'Evening favorite',
    markup: 94.44,
    locationId: 'default',
  },
  {
    categoryId: 'vapes',
    name: 'Hybrid Blend Cartridge',
    slug: 'hybrid-blend-cartridge',
    description: 'Balanced hybrid cartridge, 1g',
    displayPrice: 40,
    cost: 20,
    imageUrl:
      'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400&h=300&fit=crop',
    stock: 15,
    stockThreshold: 5,
    thcContent: '90%',
    cbdContent: '0%',
    isActive: true,
    tags: ['cartridge', 'hybrid', 'concentrate', 'premium'],
    notes: 'Premium concentrate, higher margin',
    markup: 100,
    locationId: 'default',
  },

  // Accessories
  {
    categoryId: 'accessories',
    name: 'Herb Grinder (4-piece)',
    slug: 'herb-grinder-4piece',
    description: '4-piece aluminum grinder with kief catcher',
    displayPrice: 25,
    cost: 10,
    imageUrl:
      'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=400&h=300&fit=crop',
    stock: 50,
    stockThreshold: 15,
    thcContent: '0%',
    cbdContent: '0%',
    isActive: true,
    tags: ['grinder', 'aluminum', 'kief-catcher'],
    notes: 'Best seller in accessories',
    markup: 150,
    locationId: 'default',
  },
  {
    categoryId: 'accessories',
    name: 'Rolling Papers Pack',
    slug: 'rolling-papers-pack',
    description: 'Premium rolling papers, 50-pack',
    displayPrice: 5,
    cost: 1.5,
    imageUrl:
      'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=400&h=300&fit=crop',
    stock: 200,
    stockThreshold: 50,
    thcContent: '0%',
    cbdContent: '0%',
    isActive: true,
    tags: ['papers', 'rolling', 'consumable'],
    notes: 'High volume, low margin',
    markup: 233.33,
    locationId: 'default',
  },
  {
    categoryId: 'accessories',
    name: 'Glass Tips (25-pack)',
    slug: 'glass-tips-25pack',
    description: 'Reusable glass filter tips',
    displayPrice: 8,
    cost: 3,
    imageUrl:
      'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=400&h=300&fit=crop',
    stock: 100,
    stockThreshold: 25,
    thcContent: '0%',
    cbdContent: '0%',
    isActive: true,
    tags: ['tips', 'glass', 'filters'],
    notes: 'Eco-friendly option',
    markup: 166.67,
    locationId: 'default',
  },
  {
    categoryId: 'accessories',
    name: 'Smell-Proof Container',
    slug: 'smell-proof-container',
    description: 'Airtight stash container with locking lid',
    displayPrice: 15,
    cost: 6,
    imageUrl:
      'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=400&h=300&fit=crop',
    stock: 30,
    stockThreshold: 10,
    thcContent: '0%',
    cbdContent: '0%',
    isActive: true,
    tags: ['container', 'storage', 'discrete'],
    notes: 'Quality accessory, steady demand',
    markup: 150,
    locationId: 'default',
  },
];

async function main() {
  console.log('🌱 Seeding products collection...\n');

  // First, fetch category IDs by slug
  console.log('📖 Fetching category IDs...');
  const categoriesSnapshot = await adminDb.collection('categories').get();
  
  if (categoriesSnapshot.empty) {
    console.error('❌ No categories found. Please run seed:categories first.');
    process.exit(1);
  }

  const categoryMap = new Map<string, string>();
  categoriesSnapshot.forEach((doc) => {
    const data = doc.data();
    categoryMap.set(data.slug, doc.id);
  });

  console.log(`✓ Found ${categoryMap.size} categories\n`);

  // Replace category slugs with actual IDs
  const productsWithIds = PRODUCTS.map((product) => {
    const categoryId = categoryMap.get(product.categoryId);
    if (!categoryId) {
      throw new Error(`Category not found for slug: ${product.categoryId}`);
    }
    return {
      ...product,
      categoryId,
    };
  });

  const result = await seedProductsAdmin(productsWithIds);

  if (result.success) {
    console.log(`✅ Successfully created ${result.created} products!\n`);
    console.log('📍 Location: Firestore > products collection');
    process.exit(0);
  } else {
    console.error(`❌ Error seeding products:`);
    result.errors.forEach((err) => console.error(`   - ${err}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
