import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminNav } from './AdminNav';

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
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/admin/dashboard'),
}));

vi.mock('./admin/LogoutButton', () => ({
  default: () => <button type="button">Log out</button>,
}));

vi.mock('@/assets/icons/cannabis-leaf.svg', () => ({
  default: { src: '/leaf.svg' },
}));

vi.mock('@/utils/assetSrc', () => ({
  getAssetSrc: () => '/leaf.svg',
}));

function openDrawer() {
  const toggle = screen.getByRole('button', { name: /open admin menu/i });
  fireEvent.click(toggle);
}

describe('AdminNav', () => {
  describe('owner role', () => {
    it('renders the Ops group heading and all three Ops links', () => {
      render(<AdminNav role="owner" />);
      openDrawer();

      expect(screen.getByText('Ops')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Promos' })
      ).toHaveAttribute('href', '/admin/promos');
      expect(
        screen.getByRole('link', { name: 'Email Templates' })
      ).toHaveAttribute('href', '/admin/email-templates');
      expect(
        screen.getByRole('link', { name: 'Email Queue' })
      ).toHaveAttribute('href', '/admin/email-queue');
    });

    it('renders core admin links alongside Ops', () => {
      render(<AdminNav role="owner" />);
      openDrawer();

      expect(
        screen.getByRole('link', { name: 'Dashboard' })
      ).toHaveAttribute('href', '/admin/dashboard');
      expect(
        screen.getByRole('link', { name: 'Users' })
      ).toHaveAttribute('href', '/admin/users');
    });
  });

  describe('staff role', () => {
    it('does not render the Ops group or its links', () => {
      render(<AdminNav role="staff" />);
      openDrawer();

      expect(screen.queryByText('Ops')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Promos' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Email Templates' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Email Queue' })
      ).not.toBeInTheDocument();
    });

    it('renders the staff link set', () => {
      render(<AdminNav role="staff" />);
      openDrawer();

      expect(
        screen.getByRole('link', { name: 'Products' })
      ).toHaveAttribute('href', '/admin/products');
      expect(
        screen.getByRole('link', { name: 'COA' })
      ).toHaveAttribute('href', '/admin/coa');
    });
  });
});
