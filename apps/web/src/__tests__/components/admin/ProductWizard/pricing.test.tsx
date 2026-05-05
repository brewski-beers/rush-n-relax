import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductWizardForm } from '@/components/admin/ProductWizard';
import type { ProductCategorySummary } from '@/types';

// Avoid noisy upload component in tests; not relevant to pricing UX.
vi.mock('@/components/admin/ProductImageUpload', () => ({
  ProductImageUpload: () => null,
}));

const categories: ProductCategorySummary[] = [
  {
    slug: 'edibles',
    label: 'Edibles',
    order: 1,
    requiresCannabisProfile: false,
    requiresNutritionFacts: false,
    requiresCOA: false,
  },
];

function renderWizard(action = vi.fn().mockResolvedValue({})) {
  return {
    action,
    ...render(
      <ProductWizardForm
        mode="create"
        categories={categories}
        variantTemplates={[]}
        vendors={[]}
        action={action}
      />
    ),
  };
}

function fillBasics() {
  const cat = document.querySelector(
    'select[name="category"]'
  ) as HTMLSelectElement;
  fireEvent.change(cat, { target: { value: 'edibles' } });
  const name = document.querySelector('input[name="name"]') as HTMLInputElement;
  fireEvent.change(name, { target: { value: 'Test Product' } });
  // slug auto-fills via slugify
  fireEvent.click(screen.getByRole('button', { name: /Next/i }));
  // Step 2: details
  const details = document.querySelector(
    'textarea[name="details"]'
  ) as HTMLTextAreaElement;
  fireEvent.change(details, { target: { value: 'Some details' } });
  fireEvent.click(screen.getByRole('button', { name: /Next/i }));
  // Step 3 (Cannabis Profile) is skipped for edibles → lands on Step 4 (Variants).
  // Advance once more to reach Step 5 (Pricing).
  fireEvent.click(screen.getByRole('button', { name: /Next/i }));
  // Now on Step 5 (Pricing)
}

describe('ProductWizard — Pricing step (#359 UI)', () => {
  describe('Given the user has filled basics and details', () => {
    it('renders the Pricing step indicator and dollar inputs', () => {
      renderWizard();
      fillBasics();
      expect(screen.getByText(/Step 5 of 7 — Pricing/)).toBeDefined();
      expect(
        document.querySelector('input[name="priceDollars"]')
      ).not.toBeNull();
      expect(
        document.querySelector('input[name="compareAtPriceDollars"]')
      ).not.toBeNull();
    });

    it('blocks Next when price is empty', () => {
      renderWizard();
      fillBasics();
      fireEvent.click(screen.getByRole('button', { name: /Next/i }));
      expect(screen.getByText(/Price is required\./)).toBeDefined();
      // Still on Pricing step
      expect(screen.getByText(/Step 5 of 7 — Pricing/)).toBeDefined();
    });

    it('blocks Next when price is zero', () => {
      renderWizard();
      fillBasics();
      const price = document.querySelector(
        'input[name="priceDollars"]'
      ) as HTMLInputElement;
      fireEvent.change(price, { target: { value: '0' } });
      fireEvent.click(screen.getByRole('button', { name: /Next/i }));
      expect(
        screen.getByText(/Price must be greater than \$0\./)
      ).toBeDefined();
    });

    it('converts dollars to cents in the hidden price field ($19.99 → 1999)', () => {
      renderWizard();
      fillBasics();
      const price = document.querySelector(
        'input[name="priceDollars"]'
      ) as HTMLInputElement;
      fireEvent.change(price, { target: { value: '19.99' } });
      const hidden = document.querySelector(
        'input[type="hidden"][name="price"]'
      ) as HTMLInputElement;
      expect(hidden.value).toBe('1999');
    });

    it('treats compareAtPrice as optional and converts dollars to cents ($24.50 → 2450)', () => {
      renderWizard();
      fillBasics();
      // Empty compare hidden value when blank
      const hiddenEmpty = document.querySelector(
        'input[type="hidden"][name="compareAtPrice"]'
      ) as HTMLInputElement;
      expect(hiddenEmpty.value).toBe('');

      const compare = document.querySelector(
        'input[name="compareAtPriceDollars"]'
      ) as HTMLInputElement;
      fireEvent.change(compare, { target: { value: '24.50' } });
      const hidden = document.querySelector(
        'input[type="hidden"][name="compareAtPrice"]'
      ) as HTMLInputElement;
      expect(hidden.value).toBe('2450');
    });
  });
});
