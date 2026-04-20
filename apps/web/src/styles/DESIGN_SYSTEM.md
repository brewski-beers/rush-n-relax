# Rush N Relax Design System

## Spacing Scale

All spacing values MUST use CSS custom properties. No hardcoded `rem` or `px` values for padding, margin, or gap.

| Token         | Value         | Usage                       |
| ------------- | ------------- | --------------------------- |
| `--space-xs`  | 0.5rem (8px)  | Tight spacing, icon gaps    |
| `--space-sm`  | 1rem (16px)   | Default element spacing     |
| `--space-md`  | 1.5rem (24px) | Card padding, grid gaps     |
| `--space-lg`  | 2rem (32px)   | Section margins, large gaps |
| `--space-xl`  | 2.5rem (40px) | Section padding top         |
| `--space-2xl` | 3rem (48px)   | Large section spacing       |
| `--space-3xl` | 4rem (64px)   | Hero/major section padding  |

## Semantic Tokens

Use semantic tokens over raw spacing tokens when applicable:

| Token                      | Default           | Usage                        |
| -------------------------- | ----------------- | ---------------------------- |
| `--card-padding`           | `var(--space-md)` | All card variants            |
| `--card-padding-lg`        | `var(--space-lg)` | Cards at ≥768px              |
| `--section-padding-top`    | `var(--space-xl)` | Section top padding          |
| `--section-padding-bottom` | `var(--space-lg)` | Section bottom padding       |
| `--container-padding-x`    | `var(--space-sm)` | Container horizontal padding |

## Color Tokens

| Token                   | Value                  | Usage             |
| ----------------------- | ---------------------- | ----------------- |
| `--color-bg`            | #0f1419                | Page background   |
| `--color-text`          | #e8e8e8                | Primary text      |
| `--color-text-muted`    | #b0b0b0                | Secondary text    |
| `--color-accent`        | #d5b36a                | Accent/gold color |
| `--color-border`        | rgba(255,255,255,0.1)  | Default borders   |
| `--color-border-accent` | rgba(213,179,106,0.35) | Accent borders    |
| `--color-surface`       | rgba(255,255,255,0.08) | Card backgrounds  |
| `--color-surface-hover` | rgba(255,255,255,0.12) | Card hover states |

## Component Standards

### Cards

All card variants (`rnr-card--*`) must:

- Use `var(--card-padding)` for padding
- Use `var(--color-surface)` for background
- Use `var(--color-border)` for border
- Apply hover states with `var(--color-surface-hover)` and `var(--color-border-accent)`

Use the `Card` component as the single source of truth:

- Semantic variant: `product | product-small | location | info | value`
- Surface variant: `stable | anchor`
- Elevation variant: `none | soft`
- Motion variant: `motion={true}` only for highlighted cards

Do not create page-local card classes when a `Card` variant can express the same behavior.

### Sections

Sections using asymmetry classes must:

- Use `var(--section-padding-top)` and `var(--section-padding-bottom)`
- NOT have hardcoded padding values

### Grids

Grid layouts (`*-grid`) must:

- Use `var(--space-md)` for gap
- Use `var(--space-xl)` for margin-top

### Buttons

Standard `.btn` class handles all button styling. Do not add custom padding to buttons.

## Route UI Contract Matrix

Every route follows this structure: `main > section[id] > .container > component/layout primitives`.

| Route              | Required Shell                                | Card Usage                                              | Notes                                                 |
| ------------------ | --------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| `/` Home           | `page-hero-shell` + asymmetry section classes | `Card variant=product/location` with `surface` variants | Middle card may use `anchor + soft + motion`          |
| `/about`           | asymmetry section classes                     | `Card variant=value` only for values grid               | Team section is text-only until team cards exist      |
| `/products`        | asymmetry section classes                     | `Card variant=product` grid                             | No standalone `.product-card` definitions             |
| `/products/:slug`  | asymmetry section classes                     | `Card variant=product-small` for related items          | Product detail panel is non-card content block        |
| `/locations`       | asymmetry section classes                     | `Card variant=location` list/grid                       | Highlight pattern follows index-based anchor          |
| `/locations/:slug` | asymmetry section classes                     | `Card variant=info` for visit/call/map                  | Social links stay nested content, not a new card type |
| `/contact`         | asymmetry section classes                     | location phone rows may migrate to `Card variant=info`  | Form container may remain dedicated component         |

Route definitions and section IDs must stay aligned with:

- `src/constants/routes.ts`
- `src/constants/routes.test.ts`
- `e2e/health-checks.spec.ts`

If adding a new route, update those three files in the same change.

## Forbidden Patterns

❌ `padding: 1rem` → ✅ `padding: var(--space-sm)`
❌ `padding: 1.5rem` → ✅ `padding: var(--space-md)`
❌ `padding: 2rem` → ✅ `padding: var(--space-lg)`
❌ `margin: 2.5rem` → ✅ `margin: var(--space-xl)`
❌ `gap: 1.5rem` → ✅ `gap: var(--space-md)`
❌ `#b0b0b0` → ✅ `var(--color-text-muted)`
❌ `rgba(255,255,255,0.08)` → ✅ `var(--color-surface)`

## Responsive Behavior

CSS custom properties are updated at breakpoints in `responsive.css`:

- **768px+**: `--card-padding` → `var(--space-lg)`
- **768px+**: `--section-padding-top` → `var(--space-2xl)`
- **1024px+**: Section padding increases further

This means components using tokens automatically get responsive behavior.
