'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import cannabisLeaf from '@/assets/icons/cannabis-leaf.svg';
import { getAssetSrc } from '@/utils/assetSrc';
import LogoutButton from './admin/LogoutButton';
import type { UserRole } from '@/types';

const LEAF_SRC = getAssetSrc(cannabisLeaf);

const PINNED = [{ label: 'RnR.com', href: '/' }] as const;

type NavLink = { label: string; href: string; group?: string };

const ALL_LINKS: NavLink[] = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Locations', href: '/admin/locations' },
  { label: 'Products', href: '/admin/products' },
  { label: 'Variant Groups', href: '/admin/variant-groups' },
  { label: 'Categories', href: '/admin/categories' },
  { label: 'Inventory', href: '/admin/inventory' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Promos', href: '/admin/promos', group: 'Ops' },
  { label: 'Email Templates', href: '/admin/email-templates', group: 'Ops' },
  { label: 'Email Queue', href: '/admin/email-queue', group: 'Ops' },
  { label: 'RnR.com', href: '/' },
];

/** Links available to staff role (and above via the full ALL_LINKS list). */
const STAFF_LINKS: NavLink[] = [
  { label: 'Products', href: '/admin/products' },
  { label: 'Variant Groups', href: '/admin/variant-groups' },
  { label: 'Categories', href: '/admin/categories' },
  { label: 'COA', href: '/admin/coa' },
  { label: 'RnR.com', href: '/' },
];

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

  // Track which group headings have been rendered to avoid duplicates
  const renderedGroups = new Set<string>();

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
          {drawerLinks.flatMap(link => {
            const items = [];
            if (link.group && !renderedGroups.has(link.group)) {
              renderedGroups.add(link.group);
              items.push(
                <li key={`group-${link.group}`} className="admin-nav-drawer-group-heading" aria-hidden="true">
                  {link.group}
                </li>
              );
            }
            items.push(
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`admin-drawer-link${pathname.startsWith(link.href) && link.href !== '/' ? ' admin-drawer-link--active' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            );
            return items;
          })}
          <li className="admin-nav-drawer-logout">
            <LogoutButton />
          </li>
        </ul>
      </nav>
    </div>
  );
}
