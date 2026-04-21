import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PromoClient from '@/app/(storefront)/promo/[slug]/PromoClient';
import { buildPromoDocuments } from '@/lib/fixtures';

// ── Next.js mocks ──────────────────────────────────────────────────────────
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...(props as object)}>
      {children}
    </a>
  ),
}));

// ── Firebase Storage mock ──────────────────────────────────────────────────
vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({ __stub: true })),
  getDownloadURL: vi.fn(),
}));

vi.mock('@/firebase', () => ({
  getStorage$: vi.fn(() => ({})),
  initializeApp: vi.fn(),
}));

import { getDownloadURL } from 'firebase/storage';

const mockGetDownloadURL = vi.mocked(getDownloadURL);

const activePromo = buildPromoDocuments().find(
  promo => promo.slug === 'laser-bong'
)!;

function renderPromo() {
  return render(<PromoClient promo={activePromo} locationName="Seymour" />);
}

describe('Promo page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no image resolution needed
    mockGetDownloadURL.mockResolvedValue(
      'https://cdn.example.com/promos/laser-bong.png'
    );
  });

  describe('when promo exists', () => {
    it('renders the promo name', async () => {
      renderPromo();
      expect(
        await screen.findByRole('heading', { level: 1 })
      ).toHaveTextContent(activePromo.name);
    });

    it('renders the tagline', async () => {
      renderPromo();
      expect(await screen.findByText(activePromo.tagline)).toBeInTheDocument();
    });

    it('renders the details text', async () => {
      renderPromo();
      expect(await screen.findByText(activePromo.details)).toBeInTheDocument();
    });

    it('renders the location note from server-provided locationName', async () => {
      renderPromo();
      expect(await screen.findByText(/available at/i)).toBeInTheDocument();
      expect(
        await screen.findByRole('link', { name: 'Seymour' })
      ).toHaveAttribute('href', '/locations/seymour');
    });

    it('renders the CTA link pointing to ctaPath', async () => {
      renderPromo();
      const cta = await screen.findByRole('link', { name: activePromo.cta });
      expect(cta).toBeInTheDocument();
      expect(cta).toHaveAttribute('href', activePromo.ctaPath);
    });

    it('renders the kicker pill', async () => {
      renderPromo();
      expect(await screen.findByText(/try in store/i)).toBeInTheDocument();
    });

    it('shows the image once storage URL resolves', async () => {
      renderPromo();
      const img = await screen.findByRole('img', { name: activePromo.name });
      expect(img).toHaveAttribute(
        'src',
        'https://cdn.example.com/promos/laser-bong.png'
      );
    });

    it('shows fallback placeholder while image is pending', () => {
      // Never resolves during this test
      mockGetDownloadURL.mockReturnValue(new Promise(() => {}));

      renderPromo();

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('falls back to public path when storage throws', async () => {
      mockGetDownloadURL.mockRejectedValue(new Error('Storage unavailable'));

      renderPromo();

      const img = await screen.findByRole('img', { name: activePromo.name });
      expect(img).toHaveAttribute('src', `/${activePromo.image}`);
    });
  });
});
