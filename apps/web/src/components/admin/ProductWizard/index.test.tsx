/**
 * BDD coverage for #394 — async slug-availability check on Step 1.
 *
 * Pins:
 *   - typing a free slug → "Available" + Next enabled
 *   - typing a taken slug → "Already taken…" + Next disabled
 *   - rapid typing → no stale availability (cancels in-flight request, latest
 *     response wins)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from '@testing-library/react';
import { ProductWizardForm } from './index';
import type { ProductCategorySummary } from '@/types';

// Stub child components that pull in heavy deps we don't need for these tests.
vi.mock('@/components/admin/ProductImageUpload', () => ({
  ProductImageUpload: () => <div data-testid="image-upload" />,
}));
vi.mock('@/components/ProductImage', () => ({
  ProductImage: () => <div />,
}));
vi.mock('@/lib/storage/url-cache', () => ({
  getStorageUrl: (p: string) => p,
}));
vi.mock('@/components/admin/CoaSelector', () => ({
  CoaSelector: () => <div />,
}));
vi.mock('@/components/admin/TagInput', () => ({
  TagInput: ({ name }: { name: string }) => (
    <input type="hidden" name={name} defaultValue="" />
  ),
}));
vi.mock('@/components/admin/VariantEditor', () => ({
  VariantEditor: () => <input type="hidden" name="variantGroups" value="[]" />,
}));
vi.mock('@/components/admin/NutritionFactsFields', () => ({
  NutritionFactsFields: () => <div />,
}));

const categories: ProductCategorySummary[] = [
  {
    slug: 'flower',
    label: 'Flower',
    order: 1,
    requiresCannabisProfile: true,
    requiresNutritionFacts: false,
    requiresCOA: true,
  },
];

function renderWizard() {
  const action = vi.fn(async () => ({}));
  render(
    <ProductWizardForm
      mode="create"
      categories={categories}
      variantTemplates={[]}
      vendors={[]}
      action={action}
    />
  );
}

function setupFetchMock(impl: (url: string) => Promise<Response>) {
  const fn = vi.fn(impl);
  // @ts-expect-error — jsdom doesn't ship fetch by default
  globalThis.fetch = fn;
  return fn;
}

describe('ProductWizard slug availability (Step 1)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Available" and enables Next when the slug is free', async () => {
    // Given a fetch mock that reports the slug as available
    setupFetchMock(
      async () =>
        new Response(JSON.stringify({ available: true }), { status: 200 })
    );
    renderWizard();

    // When the user enters a category and a free slug
    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { value: 'flower' },
    });
    fireEvent.change(screen.getByLabelText(/^name/i), {
      target: { value: 'Sour Diesel' },
    });

    // Then after debounce + fetch, "Available" is shown
    await waitFor(
      () => {
        expect(screen.getByText('Available')).toBeInTheDocument();
      },
      { timeout: 1500 }
    );

    // And Next is not disabled by the slug-availability gate
    const next = screen.getByRole('button', { name: /next/i });
    expect(next).not.toBeDisabled();
  });

  it('shows "Already taken" and disables Next when the slug exists', async () => {
    // Given a fetch mock that reports the slug as taken
    setupFetchMock(
      async () =>
        new Response(JSON.stringify({ available: false }), { status: 200 })
    );
    renderWizard();

    // When the user enters a duplicate slug (auto-derived from name)
    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { value: 'flower' },
    });
    fireEvent.change(screen.getByLabelText(/^name/i), {
      target: { value: 'Sour Diesel' },
    });

    // Then "Already taken…" is rendered
    await waitFor(
      () => {
        expect(
          screen.getByText(/already taken — try a different name or slug/i)
        ).toBeInTheDocument();
      },
      { timeout: 1500 }
    );

    // And the Next button is disabled
    const next = screen.getByRole('button', { name: /next/i });
    expect(next).toBeDisabled();
  });

  it('ignores stale responses when slug changes mid-flight (race-safe)', async () => {
    // Given a fetch mock where the FIRST request returns "taken" late,
    // and the SECOND request returns "available" earlier — a stale-result race.
    let callCount = 0;
    const responses: Array<{ delay: number; available: boolean }> = [
      { delay: 800, available: false }, // first: slow + taken
      { delay: 50, available: true }, //  second: fast + available
    ];

    setupFetchMock(async (_url: string) => {
      const idx = callCount++;
      const cfg = responses[idx];
      await new Promise(r => setTimeout(r, cfg.delay));
      return new Response(JSON.stringify({ available: cfg.available }), {
        status: 200,
      });
    });

    renderWizard();

    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { value: 'flower' },
    });

    // Type one slug, wait past debounce so request #1 fires, then replace it.
    fireEvent.change(screen.getByLabelText(/^name/i), {
      target: { value: 'first' },
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 320));
    });
    fireEvent.change(screen.getByLabelText(/^name/i), {
      target: { value: 'second' },
    });

    // Then the surviving state reflects the LATEST request only:
    // the AbortController cancels request #1, and even if it returned late,
    // the seqno guard would drop the stale "taken" response.
    await waitFor(
      () => {
        expect(screen.getByText('Available')).toBeInTheDocument();
      },
      { timeout: 1500 }
    );
    expect(screen.queryByText(/already taken/i)).not.toBeInTheDocument();

    // Wait long enough for request #1's delay to elapse — even if its
    // response now resolves, it must not flip our state to "taken".
    await act(async () => {
      await new Promise(r => setTimeout(r, 900));
    });
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.queryByText(/already taken/i)).not.toBeInTheDocument();
  });
});
