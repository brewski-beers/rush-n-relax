# Development Setup

This project includes **automated development seeding** with independent setup scripts.

## Quick Start (⚡ Recommended)

**Terminal 1** — Start the emulator:
```bash
npm run dev:emulators
```

**Terminal 2** — Seed the database:
```bash
npm run dev:seed
```

**Terminal 3** — Start the frontend:
```bash
npm run dev
```

The seed script will:
1. ✅ Verify emulator is running
2. 🌱 Seed 4 categories
3. 📦 Seed 13 products  
4. 👥 Seed 4 auth users with roles

Then open http://localhost:3000 to start developing.

---

## Test Accounts

After running `npm run dev:seed`, log in with any of these accounts:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@rushtonrelax.local | AdminPassword123! |
| **Manager** | manager@rushtonrelax.local | ManagerPassword123! |
| **Staff** | staff@rushtonrelax.local | StaffPassword123! |
| **Customer** | customer@rushtonrelax.local | CustomerPassword123! |

---

## Alternative Setup Methods

### Frontend Only (no seeding)
```bash
# Terminal 1: Start emulator
npm run dev:emulators

# Terminal 2: Start frontend  
npm run dev
```

### Everything at Once
```bash
# Terminal 1
npm run dev:emulators

# Terminal 2  
npm run dev:seed

# Terminal 3
npm run dev
```

---

## Emulator URLs

- 📱 **Frontend**: http://localhost:3000 or 3001
- 🔥 **Firestore**: http://localhost:8080
- 🔐 **Auth**: http://localhost:9099  
- 📊 **Emulator UI**: http://localhost:4000 (view/edit data)

---

## What's Seeded

✅ **4 Categories**
- Flower (3 products)
- Edibles (3 products)
- Vapes (3 products)
- Accessories (4 products)

✅ **13 Products** with full pricing, inventory, and metadata

✅ **4 Auth Users** with proper roles and permissions:
- Admin user with full access
- Manager with staff management permissions
- Staff with kiosk/sales access
- Customer for shopping

---

## Manual Seeding (if needed)

If you clear emulator data or need to reseed:

```bash
# Seed via HTTP endpoint (while emulator is running)
curl -X POST http://localhost:5001/rush-n-relax/us-central1/seedEverything
```

Or use the Admin Panel UI → "Seed Database" section

---

## Firestore Emulator Persistence

The emulator **saves data to disk** automatically. Each restart loads previous data.

To reset completely:
```bash
# Clear all emulator data
rm -rf ~/.cache/firebase/emulators/firestore-debug.log
rm -rf ~/.firebase-emulator-data/
```

Then restart: `npm run dev:seed`
