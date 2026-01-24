# Development Contract

## Code Organization Principles

### 1. Co-Located Test Files
**Principle**: Tests must live next to their implementation files using folder structure with index files.

**Structure**:
```
src/
├── components/
│   ├── Header/
│   │   ├── index.tsx           # Component implementation
│   │   └── index.test.tsx      # Component tests
│   └── ProductGrid/
│       ├── index.tsx
│       └── index.test.tsx
├── hooks/
│   ├── useProductBySlug/
│   │   ├── index.ts            # Hook implementation
│   │   └── index.test.ts       # Hook tests
│   └── useProductsByCategory/
│       ├── index.ts
│       └── index.test.ts
├── pages/
│   ├── Home/
│   │   └── index.tsx           # Page component
│   └── ProductDetail/
│       └── index.tsx
└── tests/
    └── setup.ts                # Test configuration only
```

**Rationale**:
- Easier to find and maintain related test files
- Clearer ownership and responsibility
- Better IDE navigation and refactoring support
- Reduces context switching between implementation and tests

**Import Pattern**:
```typescript
// External consumers use path aliases
import { Header } from '@/components/Header';
import { useProductBySlug } from '@/hooks/useProductBySlug';
import type { Product } from '@/types';

// Tests import from same folder
import { Header } from './index';
```

### 2. Path Aliases
**Principle**: Always use path aliases (`@/*`) instead of relative paths (`../../`).

**Available Aliases**:
```typescript
@/*              → src/*
@/components/*   → src/components/*
@/hooks/*        → src/hooks/*
@/pages/*        → src/pages/*
@/contexts/*     → src/contexts/*
@/types/*        → src/types/*
@/utils/*        → src/utils/*
@/styles/*       → src/styles/*
```

**❌ Bad - Relative Paths**:
```typescript
import { Header } from '../../../components/Header';
import type { Product } from '../../../../types';
import { useAuth } from '../../hooks/useAuth';
```

**✅ Good - Path Aliases**:
```typescript
import { Header } from '@/components/Header';
import type { Product } from '@/types';
import { useAuth } from '@/hooks/useAuth';
```

**Rationale**:
- **Refactor-Safe**: Move files without updating imports
- **Readable**: Clear where imports originate
- **Consistent**: No guessing `../` depth
- **IDE Support**: Better autocomplete and navigation
- **Industry Standard**: Used by Next.js, Remix, Vite projects

**Exception**: Tests in the same folder can use `./index` for self-imports.

### 3. No Dead Code
**Principle**: Any code that is no longer used must be removed immediately.

**Definition**: Dead code includes:
- Unused functions, components, or hooks
- Unreferenced constants or types
- Commented-out code blocks
- Deprecated utilities with no active consumers

**Process**:
1. Before implementing new features that replace old ones, identify what becomes obsolete
2. Remove obsolete code in the same commit/PR as the replacement
3. Search the codebase to verify no references remain
4. Update documentation to remove references to deleted code

**Example**:
```
✅ Good: Implemented useProductsByCategory → Removed useProducts hook + tests
❌ Bad: Leaving useProducts.ts in the codebase "just in case"
```

**Enforcement**:
- Pre-commit hook to detect commented-out code blocks
- Regular code audits to identify unused exports
- ESLint rules for unused variables and imports
- Build-time warnings for unreferenced modules

### 4. Single Responsibility
**Principle**: Each file, component, or function should have one clear purpose.

**Guidelines**:
- Components should render UI, not contain business logic
- Hooks should manage state or side effects, not render UI
- Utilities should be pure functions with clear inputs/outputs
- Pages should compose components, not implement features

### 5. Explicit Over Implicit
**Principle**: Code should be clear and obvious rather than clever.

**Guidelines**:
- Named exports preferred over default exports (except pages)
- Explicit type annotations for public APIs
- Clear function and variable names that describe purpose
- Avoid magic numbers or strings without constants

### 6. TDD / BDD is Mandatory
**Principle**: Tests are NOT optional. All code must be test-driven.

**Requirements**:
- **Write tests BEFORE implementation** (TDD)
- **Every utility, hook, and component must have tests**
- **Every behaviour must be explicitly tested**
- **Test file naming**: `index.test.ts` colocated with implementation
- **Test organization**: Describe blocks for features, it blocks for behaviours

**Test Coverage Minimums**:
- **Utilities**: 100% coverage (pure functions)
- **Hooks**: 100% coverage (state + side effects)
- **Repositories**: 100% coverage (data layer)
- **Components**: 80% coverage (UI + interactions)
- **Pages**: 70% coverage (integration level)
- **Overall**: Target 85% across codebase

**Test Types**:
```typescript
// Unit Tests: Pure logic in isolation
describe('calculateMarkup', () => {
  it('should calculate markup percentage correctly', () => {
    expect(calculateMarkup(100, 50)).toBe(100); // (100-50)/50 * 100
  });
  
  it('should return 0 when cost is 0', () => {
    expect(calculateMarkup(100, 0)).toBe(0);
  });
});

// Integration Tests: Multiple units working together
describe('ProductForm', () => {
  it('should submit form and save product to repository', async () => {
    const mockRepository = mock(ProductRepository);
    render(<ProductForm repository={mockRepository} />);
    
    await user.type(screen.getByLabelText('Price'), '50');
    await user.click(screen.getByText('Save'));
    
    expect(mockRepository.createProduct).toHaveBeenCalled();
  });
});
```

**Regression Prevention**:
- When a bug is found, write a failing test first
- Test must pass only after fix is implemented
- Prevents same bug from reoccurring
- Becomes part of test suite permanently

### 7. Type Safety
**Principle**: TypeScript strict mode enabled, no `any` types except in test mocks.

**Requirements**:
- All function parameters typed
- All component props typed with interfaces
- All API responses typed
- Type imports separated from value imports

### 8. Performance First
**Principle**: Optimize for runtime performance and bundle size.

**Guidelines**:
- Lazy load routes and heavy components
- Memoize expensive computations
- Avoid unnecessary re-renders
- Keep bundle size under 700KB (gzipped < 180KB)

---

## 7. Test Execution Requirements

**Principle**: Tests must complete and exit, never hang or block delivery momentum.

**Watch Mode Prohibition**:
- ❌ **DO NOT** run tests in watch mode unless explicitly requested for debugging
- ✅ **MUST** use `--run` flag to ensure tests complete and exit
- ✅ **MUST** run tests with full completion (all tests executed, results reported, process terminates)

**Execution Pattern**:
```bash
# ✅ CORRECT: Tests run and exit
npm test -- --run

# ✅ CORRECT: Specific test file with completion
npm test -- src/lib/seedDataUtils.test.ts --run

# ❌ WRONG: Watch mode hangs
npm test
npm run test:watch

# ❌ WRONG: Incomplete execution
npm test (without --run flag in CI contexts)
```

**Rationale**:
- Watch mode is for interactive debugging only
- Hanging processes block CI/CD pipelines and delivery
- Test results must be deterministic and complete
- Delivery momentum is more valuable than partial feedback

**When Watch Mode Is Acceptable**:
- Only when explicitly debugging a specific test
- Only when user says "let me investigate this test"
- Only when user says "watch this for changes"
- User must manually terminate when done

**Implementation**:
- Use `npm test -- --run` for all automated test execution
- Use `npm test` only for interactive local development (then manually quit)
- Add `--run` to all test commands in CI/CD pipelines
- Configure Vitest `run` as default in watch-unfriendly contexts

---

## Enforcement

These principles are enforced through:
1. **Code Review**: All PRs must follow these principles
2. **CI/CD**: Automated tests, linting, and type checking
3. **Documentation**: This contract is the source of truth
4. **Team Culture**: Call out violations constructively

---

**Version**: 1.0  
**Last Updated**: January 22, 2026  
**Status**: Active
