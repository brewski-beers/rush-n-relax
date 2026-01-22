# BINDING CONTRACT - Rush N Relax PWA

Follow this. Always. Violations = wasted tokens = money.

---

## PRINCIPLES (Non-negotiable)
SOLID | DRY | YAGNI | KISS | TDD | Progress over Perfection

---

## CODE STYLE & FORMATTING

**DO NOT waste tokens on formatting debates.**

- Prettier handles ALL formatting (auto-format on save)
- ESLint catches errors/anti-patterns
- Run `npm run format` before committing
- VSCode auto-formats on save - trust the config

---

## QUICK START
```
BUILD: [Feature name from backlog]
TEST: [One behavior]
```

See .github/PROMPT.md for examples.

---

## PROJECT: Cannabis Retail PWA
Customer browse | Staff POS | Admin inventory

---

## PHASE 1 SCOPE ONLY
- Product catalog (REST, no real-time)
- Staff login + POS checkout
- Admin add/edit products
- Email on order completion
- PWA installable
- Behavior tests (no unit test bloat)

---

## TECH (LOCKED - Don't suggest alternatives)
```
Frontend:  TypeScript + Vite + Plain CSS (mobile-first)
Backend:   Firebase Cloud Functions (TypeScript)
Database:  Firestore
Auth:      Firebase Auth + custom claims (RBAC)
Hosting:   Firebase Hosting
Storage:   Cloud Storage (images)
Testing:   Vitest (behavior-driven only)
Linting:   ESLint + Prettier (automated)
```

---

## CODE PATTERNS

### Firestore (Customer = REST, Staff/Admin = Real-time)
```typescript
// ✅ Customer view (cheap)
const products = await fetch('/api/products').then(r => r.json());

// ✅ Staff/Admin (justified)
onSnapshot(collection(db, 'products'), snap => { ... });

// ❌ Customer real-time (costs money)
onSnapshot(collection(db, 'products'), snap => { ... }); // NO
```

### Components (Reusable, typed)
```typescript
interface Props {
  product: Product;
  onAdd: (p: Product) => void;
}

export function ProductCard({ product, onAdd }: Props) {
  return `<div onclick="onAdd">${product.name}</div>`;
}
```

### Tests (Behavior only)
```typescript
test('adding product to cart updates total', () => {
  const cart = new Cart();
  cart.add({ price: 20 });
  expect(cart.total).toBe(20); // ✅ Behavior
});
// NOT: expect(cart.items.length).toBe(1) // ❌ Implementation
```

### Async (await, not chains)
```typescript
// ✅
const user = await loginStaff(email, password);

// ❌
loginStaff(email, password).then(user => { ... });
```

---

## FIRESTORE SECURITY RULES
```
Products:  Read public | Write admin
Orders:    Create authenticated | Read/Update staff+ | Delete admin
Users:     Own data only
```

---

## FILE STRUCTURE (as we build)
```
src/
├── main.ts
├── firebase.ts
├── styles/
│   └── index.css         (mobile-first only)
├── components/           (reusable UI)
├── services/             (business logic)
├── types/
│   └── index.ts          (shared interfaces)
└── tests/
    └── *.test.ts         (behavior only)

functions/
├── src/
│   ├── index.ts
│   ├── orders.ts
│   └── notifications.ts
└── tsconfig.json
```

---

## VIOLATION PROTOCOL

**You say:** "This violates [PRINCIPLE]"

**I respond:**
1. Acknowledge violation
2. Propose contract-honoring alternative
3. Cost impact: "X tokens saved"

---

## BACKLOG (Priority order)
- [ ] Product catalog
- [ ] Staff login
- [ ] POS cart
- [ ] Admin product form
- [ ] Email on order
- [ ] PWA install
- [ ] Behavior tests
