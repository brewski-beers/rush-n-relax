# Test Strategy & Automation

This document outlines the comprehensive testing strategy for Rush n Relax PWA, covering unit tests, integration tests, and end-to-end tests.

## Test Coverage Overview

### ✅ Unit Tests (46 tests passing)

**Location**: `src/`

#### Route Matching Utils (5 tests)

- **File**: [src/utils/routeMatching.test.ts](src/utils/routeMatching.test.ts)
- **Coverage**:
  - Root path exact matching
  - Nested route prefix matching
  - Trailing slash normalization
  - Partial prefix collision prevention
- **Purpose**: Ensures consistent active-link highlighting across navigation surfaces

#### Branding Constants (18 tests)

- **File**: [src/constants/branding.test.ts](src/constants/branding.test.ts)
- **Coverage**:
  - Logo variant enum validation
  - Brand surface definitions
  - Usage rules for each surface
  - Storage path configuration
  - Height/sizing constraints
  - Primary/Accent variant assignment
- **Purpose**: Validates single source of truth for brand rules

#### Navigation Component (14 tests)

- **File**: [src/components/Navigation/Navigation.test.tsx](src/components/Navigation/Navigation.test.tsx)
- **Coverage**:
  - Navigation structure and links
  - Logo rendering
  - Mobile menu toggle
  - Routing paths
  - Accessibility attributes
  - Social links integration
- **Purpose**: Component-level validation of navigation UI and functionality

#### AgeGate Component (9 tests)

- **File**: [src/components/AgeGate/AgeGate.test.tsx](src/components/AgeGate/AgeGate.test.tsx)
- **Coverage**:
  - localStorage persistence
  - Date validation logic
  - Age calculation (21+ check)
  - Month/Day/Year range validation
- **Purpose**: Unit-level validation of age verification core logic

### 🎭 E2E Tests (15+ scenarios)

**Location**: `e2e/`

#### Age Gate Modal (11 tests)

- **File**: [e2e/age-gate.spec.ts](e2e/age-gate.spec.ts)
- **Coverage**:
  - Modal displays in isolation (nav/footer hidden)
  - Input fields visible and not cutoff
  - Auto-focus advances between fields
  - Max length enforcement
  - Age validation (21+ check)
  - Successful verification flow
  - Complete birth date requirement
  - Date range validation
  - localStorage persistence
  - Enter key submission
  - Disclaimer text display
- **Purpose**: Full browser validation of age gate UX and flow

#### User Journey (8 tests)

- **File**: [e2e/user-journey.spec.ts](e2e/user-journey.spec.ts)
- **Coverage**:
  - Full age verification → browsing flow
  - Verification persistence across pages
  - Invalid age rejection
  - Contact form access
  - Location page display
  - Footer visibility post-verification
  - Logo rendering in header/footer
  - Navigation between pages
- **Purpose**: Real-world user journey validation

#### App Health Checks (15+ tests)

- **File**: [e2e/health-checks.spec.ts](e2e/health-checks.spec.ts)
- **Coverage**:
  - Page load status (200 OK)
  - No console errors
  - Ambient overlay rendering
  - Navigation links functional
  - SEO compliance (meta, titles, OG tags)
  - Accessibility (main landmark, link targets)
  - Responsive design (mobile/tablet/desktop)
  - Performance metrics
- **Purpose**: Production readiness validation

#### Product Browsing (5+ tests)

- **File**: [e2e/app.spec.ts](e2e/app.spec.ts)
- **Coverage**:
  - Homepage category load
  - Category navigation
  - Product detail pages
  - Product information display
  - Out of stock handling
- **Purpose**: Core product browsing UX

## Running Tests

### Unit Tests (Fast - ~1.4s)

```bash
npm run test                    # Run in watch mode
npm run test -- --run          # Run once and exit
npm run test:coverage          # Generate coverage report
```

### E2E Tests (Medium - ~30-60s per run)

```bash
npm run test:e2e               # Run all e2e tests
npm run test:e2e:ui            # Run with interactive UI
npm run test:e2e:debug         # Run with debugger
npm run test:health            # Run health checks only
```

### Full Test Suite

```bash
npm run test -- --run && npm run test:e2e
```

## CI/CD Integration

### Pre-commit Checks

```bash
npm run lint        # ESLint validation
npm run format:check # Prettier validation
npm run test -- --run   # Unit tests (fast)
```

### Pre-deployment

```bash
npm run build       # TypeScript + Vite build
npm run test:e2e    # Full E2E suite
```

## Test Architecture

### Unit Tests

- **Framework**: Vitest
- **Library**: @testing-library/react, jest-dom
- **Approach**: Test pure functions, enums, constants in isolation
- **Mocking**: Firebase API mocked to avoid external dependencies
- **Setup**: [src/tests/setup.ts](src/tests/setup.ts) - Cleanup hooks, jest-dom matchers

### E2E Tests

- **Framework**: Playwright
- **Approach**: Real browser automation with full app context
- **Configuration**: [playwright.config.ts](playwright.config.ts)
- **Viewports**: Android, iPhone, iPad, Desktop
- **Features**:
  - Automatic retry on failure
  - Video recording on failure
  - Trace collection for debugging
  - Parallel execution

## Critical Paths Covered

✅ **Age Gate Flow**

- Modal displays on first visit
- User input validation (month/day/year)
- Age calculation accuracy (21+ threshold)
- localStorage persistence
- Page navigation post-verification

✅ **Navigation & Routing**

- All route links function correctly
- Active link styling updates correctly
- Nested routes handled (e.g., /products/flower)
- Mobile and desktop navigation both work

✅ **Branding System**

- Logo variants correctly assigned per surface
- Firebase Storage fallback works
- Icon sizing constraints enforced
- PWA manifest includes correct icons

✅ **Product Browsing**

- Categories load from Firestore
- Product detail pages accessible
- Add to cart flow works
- Mobile responsiveness maintained

✅ **Production Readiness**

- No console errors on any page
- All pages return HTTP 200
- SEO meta tags present
- Accessibility landmarks correct

## Coverage Gaps (Future Enhancements)

- [x] Age gate modal UX
- [x] Navigation & routing
- [x] Branding rules validation
- [ ] Firebase Firestore queries (requires emulator)
- [ ] Cart functionality (requires context/state tests)
- [ ] Contact form submission
- [ ] Payment integration (stage-gated)
- [ ] Service Worker functionality (PWA tests)
- [ ] Analytics event tracking

## Debugging Failing Tests

### Unit Test Failures

```bash
npm run test -- src/utils/routeMatching.test.ts    # Run single file
npm run test -- --reporter=verbose                 # Verbose output
```

### E2E Test Failures

```bash
npm run test:e2e:debug src/specs/age-gate.spec.ts  # Step through with debugger
npm run test:e2e:ui                                 # Visual UI runner
npx playwright show-trace path/to/trace.zip         # Review trace
```

## Performance Benchmarks

| Test Suite    | Duration | Count         |
| ------------- | -------- | ------------- |
| Unit Tests    | ~1.4s    | 46 tests      |
| E2E Tests     | ~30-60s  | 40+ tests     |
| Build + Tests | ~2-3m    | Full pipeline |

## Best Practices

1. **Keep unit tests focused** - Test one thing per test
2. **Use meaningful test names** - Describe the behavior being tested
3. **Avoid test interdependencies** - Each test should work in isolation
4. **Mock external services** - Firebase, APIs, etc.
5. **Test user behavior** - Not implementation details
6. **Use page.waitForSelector()** - Not arbitrary timeouts in E2E tests
7. **Isolate component tests** - Reset state (localStorage, mocks) before each test

## Validation Checklist

Before deploying to production:

- [ ] All unit tests pass (`npm run test -- --run`)
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] No console errors in browser
- [ ] Build succeeds without warnings (`npm run build`)
- [ ] Coverage maintained or improved
- [ ] Performance metrics acceptable
- [ ] Accessibility audit passes
- [ ] Mobile testing on real devices

## Resources

- **Vitest Docs**: https://vitest.dev/
- **Playwright Docs**: https://playwright.dev/
- **Testing Library**: https://testing-library.com/
- **Best Practices**: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library
