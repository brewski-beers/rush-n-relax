import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Product } from '../src/types';

// Initialize Firebase Admin with emulator settings
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

initializeApp({
  projectId: 'rush-n-relax',
});

const db = getFirestore();

// Verify connection
console.log('🔧 Connecting to Firestore Emulator at:', process.env.FIRESTORE_EMULATOR_HOST);
console.log('🔧 Project ID:', 'rush-n-relax');

const SEED_PRODUCTS: Omit<Product, 'id'>[] = [
  {
    name: 'Blue Dream',
    description: 'Sativa-dominant hybrid strain with balanced full-body relaxation and cerebral invigoration',
    price: 45,
    stock: 50,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/300x400/4287f5/white?text=Blue+Dream',
    category: 'flower',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'OG Kush',
    description: 'Classic indica strain known for its stress-relieving properties and earthy pine aroma',
    price: 50,
    stock: 35,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/300x400/2e7d32/white?text=OG+Kush',
    category: 'flower',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Strawberry Gummies',
    description: '10mg THC per piece, perfect for controlled dosing with delicious strawberry flavor',
    price: 25,
    stock: 100,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/300x400/e91e63/white?text=Gummies',
    category: 'edibles',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Chocolate Bar 100mg',
    description: 'Premium dark chocolate infused with 100mg THC, divided into 10 easy-to-dose squares',
    price: 30,
    stock: 60,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/300x400/5d4037/white?text=Chocolate',
    category: 'edibles',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Sour Diesel Vape',
    description: 'Energizing sativa vape pen with 85% THC, perfect for daytime use',
    price: 40,
    stock: 75,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/300x400/ff9800/white?text=Vape+Pen',
    category: 'vapes',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Hybrid Vape Cart',
    description: '1g cartridge with balanced hybrid blend, compatible with 510 thread batteries',
    price: 35,
    stock: 80,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/300x400/9c27b0/white?text=Cart',
    category: 'vapes',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Glass Pipe - Helix',
    description: 'High-quality borosilicate glass pipe with unique helix design for smooth hits',
    price: 35,
    stock: 25,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/300x400/00bcd4/white?text=Glass+Pipe',
    category: 'accessories',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Rolling Papers Pack',
    description: 'Premium hemp rolling papers, 50 sheets per pack, slow-burning',
    price: 5,
    stock: 200,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/300x400/8bc34a/white?text=Papers',
    category: 'accessories',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

async function seedProducts() {
  console.log('🌱 Seeding products to Firestore emulator...');
  
  const batch = db.batch();
  
  for (const product of SEED_PRODUCTS) {
    const docRef = db.collection('products').doc();
    batch.set(docRef, {
      ...product,
      id: docRef.id,
    });
  }
  
  await batch.commit();
  
  console.log(`✅ Successfully seeded ${SEED_PRODUCTS.length} products`);
  
  // Verify
  const snapshot = await db.collection('products').get();
  console.log(`📊 Total products in database: ${snapshot.size}`);
  
  process.exit(0);
}

seedProducts().catch((error) => {
  console.error('❌ Error seeding products:', error);
  process.exit(1);
});
