# Prompt Template

## Copy-Paste This

```
Follow .github/copilot_instructions.md
BUILD: [Next backlog item]
TEST: [Behavior]
```

## Backlog (In Order)

1. **Product catalog** - Foundation
2. **Staff login** - Auth
3. **POS cart** - Business logic
4. **Admin form** - CRUD
5. **Email trigger** - Notifications
6. **PWA install** - Deployment

## Examples

### 1. Product Catalog

```
Follow .github/copilot_instructions.md
BUILD: Product catalog
TEST: Fetch via REST, grid display, 320px responsive
```

### 2. Staff Login

```
Follow .github/copilot_instructions.md
BUILD: Staff login
TEST: Email/password → validate role → redirect to POS
```

### 3. POS Cart

```
Follow .github/copilot_instructions.md
BUILD: POS cart
TEST: Add product → total updates, remove → total updates
```

### 4. Admin Form

```
Follow .github/copilot_instructions.md
BUILD: Admin product form
TEST: Submit → Firestore save → customers see real-time
```

### 5. Email Trigger

```
Follow .github/copilot_instructions.md
BUILD: Order notification function
TEST: Order created → email sent
```

### 6. PWA Install

```
Follow .github/copilot_instructions.md
BUILD: Service worker + manifest
TEST: App installable, works offline
```

---

Keep prompts SHORT. Contract handles the rest.
