import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminTablePagination } from '@/components/admin/AdminTablePagination';

describe('AdminTablePagination', () => {
  describe('given a bare baseHref', () => {
    it('appends cursor params with `?`', () => {
      render(
        <AdminTablePagination
          baseHref="/admin/products"
          prevCursor={undefined}
          nextCursor="Mango Kush"
          prevCursorsStack={[]}
          nextCursorsStack={[]}
        />
      );

      const next = screen.getByRole('link', { name: /next/i });
      expect(next.getAttribute('href')).toBe(
        '/admin/products?cursor=Mango+Kush'
      );
    });
  });

  describe('given a baseHref that already contains a query string', () => {
    it('joins cursor params with `&`, never producing a second `?`', () => {
      render(
        <AdminTablePagination
          baseHref="/admin/products?category=flower&q=mango"
          prevCursor="Blue Dream"
          nextCursor="OG Kush"
          prevCursorsStack={[]}
          nextCursorsStack={['Mango Kush']}
        />
      );

      const next = screen.getByRole('link', { name: /next/i });
      const prev = screen.getByRole('link', { name: /previous/i });

      const nextHref = next.getAttribute('href') ?? '';
      const prevHref = prev.getAttribute('href') ?? '';

      // Exactly one `?` in each URL — the rest must be `&` joins.
      expect(nextHref.split('?')).toHaveLength(2);
      expect(prevHref.split('?')).toHaveLength(2);

      expect(nextHref).toContain('category=flower');
      expect(nextHref).toContain('q=mango');
      expect(nextHref).toContain('cursor=OG+Kush');
      expect(nextHref).toContain('prevCursors=Mango+Kush');

      expect(prevHref).toContain('category=flower');
      expect(prevHref).toContain('cursor=Blue+Dream');
    });
  });

  describe('given no prev and no next cursor', () => {
    it('renders nothing', () => {
      const { container } = render(
        <AdminTablePagination
          baseHref="/admin/products"
          prevCursor={undefined}
          nextCursor={null}
          prevCursorsStack={[]}
          nextCursorsStack={[]}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });
});
