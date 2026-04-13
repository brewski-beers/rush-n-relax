import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoaSection } from '@/components/CoaSection';
import type { CoaDocument } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeDoc(overrides: Partial<CoaDocument> = {}): CoaDocument {
  return {
    name: 'COA/blue-dream-2024-01.pdf',
    label: 'Blue Dream 2024 01',
    downloadUrl: 'https://storage.example.com/signed-url',
    size: 2048,
    updatedAt: new Date('2024-01-15T00:00:00.000Z'),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CoaSection', () => {
  describe('Given docs is empty', () => {
    it('renders the empty-state message', () => {
      render(<CoaSection docs={[]} />);

      expect(
        screen.getByText('No COA documents are currently available.')
      ).toBeInTheDocument();
    });
  });

  describe('Given docs contains items', () => {
    it('renders each label and a download link', () => {
      const docs = [
        makeDoc({
          label: 'Blue Dream 2024 01',
          downloadUrl: 'https://example.com/blue',
        }),
        makeDoc({
          name: 'COA/og-kush-2023.pdf',
          label: 'Og Kush 2023',
          downloadUrl: 'https://example.com/og',
        }),
      ];

      render(<CoaSection docs={docs} />);

      expect(screen.getByText('Blue Dream 2024 01')).toBeInTheDocument();
      expect(screen.getByText('Og Kush 2023')).toBeInTheDocument();

      const links = screen.getAllByRole('link', { name: /download pdf/i });
      expect(links).toHaveLength(2);
    });
  });

  describe('Given a doc', () => {
    it('link has target="_blank" and rel="noopener noreferrer"', () => {
      const doc = makeDoc({ downloadUrl: 'https://example.com/secure-url' });

      render(<CoaSection docs={[doc]} />);

      const link = screen.getByRole('link', { name: /download pdf/i });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('href', 'https://example.com/secure-url');
    });
  });
});
