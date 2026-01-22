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

### 6. Test Coverage Requirements
**Principle**: All business logic must have test coverage.

**Requirements**:
- Components: Test rendering, props, user interactions
- Hooks: Test state changes, loading states, error handling
- Utilities: Test edge cases and error conditions
- Pages: Integration tests preferred over unit tests

**Minimum Coverage**:
- Critical paths: 100%
- Business logic: 90%
- UI components: 80%
- Overall project: 70%

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
