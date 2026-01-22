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
    slug: 'blue-dream',
    description: 'A legendary sativa-dominant hybrid combining Blueberry and Haze genetics. Blue Dream delivers swift symptom relief with balanced full-body relaxation and gentle cerebral invigoration. Perfect for both novice and veteran cannabis users seeking a harmonious blend of therapeutic benefits and uplifting effects.',
    price: 45,
    stock: 50,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/800x600/4287f5/white?text=Blue+Dream',
    category: 'flower',
    thcContent: '18-24%',
    cbdContent: '<1%',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'OG Kush',
    slug: 'og-kush',
    description: 'The backbone of West Coast cannabis genetics. This classic indica-dominant hybrid delivers a complex aroma of fuel, skunk, and spice with stress-relieving and euphoric effects. OG Kush is celebrated for its ability to crush stress under the weight of its heavy tranquility.',
    price: 50,
    stock: 35,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/800x600/2e7d32/white?text=OG+Kush',
    category: 'flower',
    thcContent: '20-25%',
    cbdContent: '<1%',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Strawberry Gummies',
    slug: 'strawberry-gummies',
    description: 'Delicious and precisely dosed strawberry-flavored gummies made with premium cannabis extract. Each piece contains exactly 10mg of THC, making it easy to find your perfect dose. Made with real fruit flavors and all-natural ingredients for a consistent, enjoyable edible experience.',
    price: 25,
    stock: 100,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/800x600/e91e63/white?text=Strawberry+Gummies',
    category: 'edibles',
    thcContent: '10mg per piece',
    cbdContent: '<1mg',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Dark Chocolate Bar 100mg',
    slug: 'dark-chocolate-bar-100mg',
    description: 'Artisanal dark chocolate (70% cacao) infused with 100mg of premium THC distillate. Each bar is divided into 10 perfectly scored 10mg squares for easy, accurate dosing. Rich, smooth chocolate taste with no cannabis aftertaste. Perfect for chocolate lovers seeking a sophisticated edible experience.',
    price: 30,
    stock: 60,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/800x600/5d4037/white?text=Dark+Chocolate',
    category: 'edibles',
    thcContent: '100mg total (10mg per square)',
    cbdContent: '<5mg',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Sour Diesel Vape',
    slug: 'sour-diesel-vape',
    description: 'All-in-one disposable vape pen featuring Sour Diesel, the legendary sativa strain. Contains 85% pure THC distillate with naturally derived terpenes for an authentic strain-specific experience. Delivers energizing, dreamy cerebral effects perfect for daytime use. No charging or filling required.',
    price: 40,
    stock: 75,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/800x600/ff9800/white?text=Sour+Diesel+Vape',
    category: 'vapes',
    thcContent: '85%',
    cbdContent: '<1%',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Hybrid Blend Cartridge',
    slug: 'hybrid-blend-cartridge',
    description: 'Premium 1-gram vape cartridge featuring a carefully balanced hybrid blend. Made with pure cannabis oil and botanically derived terpenes. Compatible with any 510-thread battery. Delivers smooth, flavorful vapor with balanced mind and body effects ideal for any time of day.',
    price: 35,
    stock: 80,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/800x600/9c27b0/white?text=Hybrid+Cart',
    category: 'vapes',
    thcContent: '78-82%',
    cbdContent: '<2%',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Helix Glass Pipe',
    slug: 'helix-glass-pipe',
    description: 'Premium hand-blown borosilicate glass pipe featuring the innovative Helix design. The unique chamber creates a spinning vortex that cools and filters smoke for incredibly smooth hits. Durable, heat-resistant glass with microventuri technology. Approximately 6 inches in length.',
    price: 35,
    stock: 25,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/800x600/00bcd4/white?text=Helix+Glass+Pipe',
    category: 'accessories',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Organic Hemp Rolling Papers',
    slug: 'organic-hemp-rolling-papers',
    description: 'Ultra-thin, slow-burning rolling papers made from 100% organic hemp. Each pack contains 50 sheets of natural, unbleached paper with no added chemicals or flavors. Features a natural gum Arabic adhesive. Perfect for those who prefer to roll their own and value purity and sustainability.',
    price: 5,
    stock: 200,
    locationId: 'main-store',
    imageUrl: 'https://placehold.co/800x600/8bc34a/white?text=Rolling+Papers',
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
