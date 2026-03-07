import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Promo from './Promo';
import { PROMOS } from '../constants/promos';

// ── Firebase Storage mock ──────────────────────────────────────────────────
vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({ __stub: true })),
  getDownloadURL: vi.fn(),
}));

vi.mock('../firebase', () => ({
  getStorage$: vi.fn(() => ({})),
  initializeApp: vi.fn(),
}));

// ── usePromo mock ──────────────────────────────────────────────────────────
vi.mock('../hooks/usePromo', () => ({
  usePromo: vi.fn(),
}));

import { getDownloadURL } from 'firebase/storage';
import { usePromo } from '../hooks/usePromo';

const mockGetDownloadURL = vi.mocked(getDownloadURL);
const mockUsePromo = vi.mocked(usePromo);

const activePromo = PROMOS.find(p => p.slug === 'laser-bong')!;

function renderPromo(slug = 'laser-bong') {
  return render(
    <MemoryRouter initialEntries={[`/promo/${slug}`]}>
      <Routes>
        <Route path="/promo/:slug" element={<Promo />} />
        <Route path="/" element={<div data-testid="home" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Promo page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no image resolution needed
    mockGetDownloadURL.mockResolvedValue(
      'https://cdn.example.com/promos/laser-bong.png'
    );
  });

  describe('when promo is null (unknown/inactive slug)', () => {
    it('redirects to home', async () => {
      mockUsePromo.mockReturnValue({ promo: null, status: 'error' });

      renderPromo('not-real');

      await waitFor(() => {
        expect(screen.getByTestId('home')).toBeInTheDocument();
      });
    });

    it('renders nothing for the promo page itself', () => {
      mockUsePromo.mockReturnValue({ promo: null, status: 'error' });

      renderPromo('not-real');

      expect(screen.queryByRole('main')).not.toBeInTheDocument();
    });
  });

  describe('when promo exists', () => {
    beforeEach(() => {
      mockUsePromo.mockReturnValue({ promo: activePromo, status: 'success' });
    });

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

  describe('when promo is loading (static fallback)', () => {
    it('renders static content while Firestore is pending', async () => {
      mockUsePromo.mockReturnValue({ promo: activePromo, status: 'loading' });

      renderPromo();

      expect(
        await screen.findByRole('heading', { level: 1 })
      ).toHaveTextContent(activePromo.name);
    });
  });
});
