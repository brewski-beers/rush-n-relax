# Testing Instructions

## Architecture Change

**Direct Firestore Access** - Products are loaded directly from Firestore SDK (client-side) instead of Cloud Functions. This simplifies the architecture and reduces costs.

## Start Testing

### 1. Start Firebase Emulators
```bash
firebase emulators:start
```

Wait for this output:
```
✔  All emulators ready! It is now safe to connect your app.
```

### 2. Seed Products (New Terminal)
```bash
npm run seed:products
```

Expected output:
```
🔧 Connecting to Firestore Emulator at: 127.0.0.1:8080
🔧 Project ID: rush-n-relax
🌱 Seeding products to Firestore emulator...
✅ Successfully seeded 8 products
📊 Total products in database: 8
```

### 3. Verify in Emulator UI
Open: http://127.0.0.1:4000/firestore

You should see:
- **products** collection with 8 documents
- Each document has: name, description, price, stock, category, imageUrl

### 4. Start Dev Server (New Terminal)
```bash
npm run dev
```

Visit: http://localhost:3000

**Expected**: Product grid displays 8 real products from Firestore

## How It Works

1. **[src/hooks/useProducts.ts](../src/hooks/useProducts.ts)** - Uses `getDocs()` from Firebase SDK
2. **[src/firebase.ts](../src/firebase.ts)** - Connects to Firestore emulator in dev mode
3. **[firestore.rules](../firestore.rules)** - Public read access to products collection

No Cloud Functions needed for read operations! 🎉

## Files Changed
- [src/hooks/useProducts.ts](../src/hooks/useProducts.ts) - Direct Firestore access
- [src/tests/hooks/useProducts.test.ts](../src/tests/hooks/useProducts.test.ts) - Updated mocks
- [functions/index.ts](../functions/index.ts) - Removed products endpoint (kept helloWorld for reference)
