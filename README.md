# Rush n Relax - Cannabis Retail PWA

A modern, mobile-first Progressive Web App for cannabis retail operations and staff POS management built with TypeScript, Vite, and Firebase.

## Features

- **Mobile-First Design** - Optimized for mobile devices with progressive enhancement for larger screens
- **PWA Support** - Offline functionality, installable, fast loading
- **Firebase Integration** - Real-time Firestore database with secure rules
- **POS Mode** - Staff point-of-sale functionality for retail operations
- **Customer Ordering** - E-commerce interface for product browsing and orders
- **Real-Time Sync** - Live inventory and order updates

## Project Structure

\\\
rush-n-relax/
 src/                    # TypeScript source code
    main.ts            # Application entry point
    firebase.ts        # Firebase initialization
    style.css          # Global styles (mobile-first)
    components/        # UI components
    utils/
        auth.ts        # Authentication utilities
 public/                 # Static assets
    manifest.json      # PWA manifest
 functions/             # Cloud Functions
    src/
       index.ts       # Functions entry point
    package.json
    tsconfig.json
 vite.config.ts         # Vite configuration
 tsconfig.json          # TypeScript configuration
 firebase.json          # Firebase hosting config
 firestore.rules        # Firestore security rules
 package.json
 index.html             # HTML entry point
\\\

## Development

### Prerequisites

- Node.js 16+
- Firebase CLI
- npm or pnpm

### Setup

\\\ash
npm install
firebase login
\\\

### Running Locally

\\\ash
# Start development server and Firebase emulators
npm run dev
firebase emulators:start

# In another terminal
npm run firebase:emulate
\\\

### Building

\\\ash
npm run build
\\\

### Testing

Rush n Relax uses a two-layer test strategy: fast **unit tests** via Vitest and
real-browser **E2E tests** via Playwright.

#### Unit Tests (Vitest)

```bash
npm test              # Run all unit tests
npm run test:ui       # Interactive Vitest UI
npm run test:coverage # Generate coverage report
```

Unit tests live alongside source files (`*.test.ts` / `*.test.tsx`) and cover
pure logic — route matching, branding constants, component rendering, age-gate
validation.

#### E2E Tests (Playwright)

E2E tests are split into three tiers controlled by the `TEST_MODE` env var.
This keeps local feedback loops fast while CI validates everything.

| Tier | Command | What it runs | When to use |
|------|---------|-------------|-------------|
| **Smoke** | `npm run test:e2e:smoke` | Age gate only (Chromium) | Every save / pre-commit |
| **Core** | `npm run test:e2e:core` | Age gate + journeys + app (Chromium + Mobile) | Before pushing a branch |
| **Full** | `npm run test:e2e:full` | All specs, all browsers | CI / release gate |

```bash
# Quick check — runs in < 15s
npm run test:e2e:smoke

# Broader validation — runs in ~30s
npm run test:e2e:core

# Exhaustive — runs in CI
npm run test:e2e:full
```

#### E2E Architecture & Conventions

All E2E specs follow a standardized pattern:

1. **Shared fixtures** — Import helpers from `e2e/fixtures.ts`:
   - `verifyAge(page)` — UI-based age verification (fills form, submits, waits
     for overlay to dismiss). Use when testing the gate-to-app transition.
   - `preVerifyAge(page)` — Injects `localStorage.setItem('ageVerified', 'true')`
     via `addInitScript`. Fastest path — **use this by default** when age-gate
     verification is not the thing under test.

2. **No `networkidle`** — The app loads with zero startup network calls
   (products, locations, and categories are static constants). Wait for a
   visible DOM element instead:
   ```ts
   // BAD  — hangs for 30+ seconds
   await page.waitForLoadState('networkidle');

   // GOOD — resolves in <500ms
   await page.locator('main').waitFor({ state: 'visible', timeout: 5000 });
   ```

3. **Tight timeouts** — Static pages render in under 2 seconds. Never exceed
   `8000ms` for a selector wait; prefer `5000ms`.

4. **No redundant coverage** — Each spec owns a clear domain:
   | Spec file | Domain |
   |-----------|--------|
   | `age-gate.spec.ts` | Age-gate UX: valid/invalid dates, persistence, error states |
   | `user-journey.spec.ts` | Post-verification navigation, page transitions, layout |
   | `app.spec.ts` | Product browsing, category navigation, a11y, performance |
   | `health-checks.spec.ts` | Page loads, SEO, responsive, contact form, web vitals |

5. **Mock external calls** — The only network dependency is the contact form's
   Firestore write (`addDoc`). Mock it with `page.route()`:
   ```ts
   await page.route('**/firestore.googleapis.com/**', (route) =>
     route.fulfill({ status: 200, body: '{}' }),
   );
   ```

6. **Browser matrix** — Local dev runs Chromium + Mobile Chrome (2 browsers).
   Full CI adds Firefox, Safari, and tablet viewports.

### Deployment

\\\ash
npm run deploy
\\\

## Architecture Principles

### SOLID
- **S**ingle Responsibility: Each module has one reason to change
- **O**pen/Closed: Open for extension, closed for modification
- **L**iskov Substitution: Subtypes are substitutable for base types
- **I**nterface Segregation: Specific interfaces over general ones
- **D**ependency Inversion: Depend on abstractions, not concretions

### DRY (Don't Repeat Yourself)
- Reusable utilities and components
- Shared logic in dedicated modules
- No code duplication

### YAGNI (You Aren't Gonna Need It)
- Build what's needed now
- Avoid speculative features
- Embrace incremental development

### KISS (Keep It Simple, Stupid)
- Simple, readable code
- Straightforward solutions
- Avoid unnecessary complexity

### Mobile-First UI
- Design for smallest screen first
- Progressive enhancement for larger screens
- Touch-friendly interactions
- Performance optimized for mobile networks

### BDD/Value-Added Tests
- Test behavior, not implementation
- Only tests that provide real value
- No bloat or trivial assertions
- Focus on user-visible functionality

## Firebase Configuration

### Firestore Rules

Security rules enforce:
- Authentication requirements
- Role-based access (admin, staff, user)
- Location-based access for staff
- Data ownership validation

### Cloud Functions

Handles:
- Order processing
- Inventory management
- Payment processing
- Email notifications

## License

MIT
