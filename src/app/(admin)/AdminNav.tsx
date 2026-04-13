'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import cannabisLeaf from '@/assets/icons/cannabis-leaf.svg';
import { getAssetSrc } from '@/utils/assetSrc';
import LogoutButton from './admin/LogoutButton';
import type { UserRole } from '@/types';

const LEAF_SRC = getAssetSrc(cannabisLeaf);

const PINNED = [
  { label: 'Inventory', href: '/admin/inventory' },
  { label: 'Users', href: '/admin/users' },
] as const;

const ALL_LINKS = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Locations', href: '/admin/locations' },
  { label: 'Products', href: '/admin/products' },
  { label: 'Categories', href: '/admin/categories' },
  { label: 'Promos', href: '/admin/promos' },
  { label: 'Inventory', href: '/admin/inventory' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Email Templates', href: '/admin/email-templates' },
  { label: 'Email Queue', href: '/admin/email-queue' },
  { label: '← Client Site', href: '/' },
] as const;

/** Links available to staff role (and above via the full ALL_LINKS list). */
const STAFF_LINKS = [
  { label: 'Products', href: '/admin/products' },
  { label: 'Categories', href: '/admin/categories' },
  { label: 'COA', href: '/admin/coa' },
  { label: '← Client Site', href: '/' },
] as const;

interface AdminNavProps {
  role: UserRole | null;
}

export function AdminNav({ role }: AdminNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const isStaffOnly = role === 'staff';
  const drawerLinks = isStaffOnly ? STAFF_LINKS : ALL_LINKS;

  return (
    <div className="admin-nav">
      {!isStaffOnly && (
        <div className="admin-nav-pinned" aria-label="Pinned admin links">
          {PINNED.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`admin-nav-pinned-link${pathname.startsWith(link.href) ? ' admin-nav-pinned-link--active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}

      <button
        type="button"
        className={`admin-nav-toggle${isOpen ? ' active' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={isOpen ? 'Close admin menu' : 'Open admin menu'}
        aria-expanded={isOpen}
        aria-controls="admin-nav-drawer"
      >
        {LEAF_SRC ? (
          <img src={LEAF_SRC} alt="" className="cannabis-leaf-icon" />
        ) : (
          <span aria-hidden="true">🌿</span>
        )}
      </button>

      {isOpen && (
        <div
          className="admin-nav-overlay"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        id="admin-nav-drawer"
        className={`admin-nav-drawer${isOpen ? ' active' : ''}`}
        aria-label="Full admin navigation"
      >
        <ul className="admin-nav-drawer-list">
          {drawerLinks.map(link => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`admin-drawer-link${pathname.startsWith(link.href) && link.href !== '/' ? ' admin-drawer-link--active' : ''}`}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="admin-nav-drawer-logout">
            <LogoutButton />
          </li>
        </ul>
      </nav>
    </div>
  );
}
