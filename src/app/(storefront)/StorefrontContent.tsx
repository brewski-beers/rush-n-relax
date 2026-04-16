'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useNavigation } from '@/contexts/useNavigation';
import { AmbientOverlay } from '@/components/AmbientOverlay';
import { AgeGate } from '@/components/AgeGate';
import { Navigation } from '@/components/Navigation';
import { CartProvider } from '@/contexts/CartContext';
import { useCart } from '@/hooks/useCart';
import { formatCents } from '@/utils/currency';
import { isRouteActive } from '@/utils/routeMatching';

const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Locations', path: '/locations' },
  { label: 'Products', path: '/products' },
  { label: 'Contact', path: '/contact' },
] as const;

function ModalCartSection({ onClose }: { onClose: () => void }) {
  const { totalItems: itemCount, subtotal: total } = useCart();
  return (
    <Link href="/cart" className="modal-cart" onClick={onClose}>
      <div className="modal-cart-icon" aria-hidden="true">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        {itemCount > 0 && <span className="modal-cart-badge">{itemCount}</span>}
      </div>
      <span className="modal-cart-label">
        {itemCount === 0
          ? 'Your cart is empty'
          : `${itemCount} item${itemCount !== 1 ? 's' : ''} · ${formatCents(total)}`}
      </span>
      <span className="modal-cart-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

function DesktopModal() {
  const { isMenuOpen, setIsMenuOpen } = useNavigation();
  const pathname = usePathname();
  const modalRef = useRef<HTMLDivElement>(null);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.currentTarget === e.target) {
      setIsMenuOpen(false);
    }
  };

  useEffect(() => {
    if (!isMenuOpen || !modalRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMenuOpen(false);
        return;
      }
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'a, button, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements || focusableElements.length === 0) return;
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[
          focusableElements.length - 1
        ] as HTMLElement;
        const activeElement = document.activeElement;
        if (e.shiftKey && activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
          return;
        }
        if (!e.shiftKey && activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const firstLink = modalRef.current?.querySelector('a') as HTMLElement;
    if (firstLink) setTimeout(() => firstLink.focus(), 0);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  if (!isMenuOpen) return null;

  return (
    <>
      <div
        className="modal-backdrop"
        onClick={handleBackdropClick}
        onKeyDown={e => {
          if (e.key === 'Escape') setIsMenuOpen(false);
        }}
        role="button"
        tabIndex={0}
        aria-label="Close menu"
      />
      <div
        ref={modalRef}
        id="nav-menu"
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title" className="sr-only">
          Navigation Menu
        </h2>
        <ModalCartSection onClose={() => setIsMenuOpen(false)} />
        <nav className="modal-menu-items" aria-label="Main navigation">
          {NAV_LINKS.map((link, index) => (
            <Link
              key={link.path}
              href={link.path}
              onClick={() => setIsMenuOpen(false)}
              className={`modal-link${index === Math.floor(NAV_LINKS.length / 2) ? ' modal-link--center' : ''}`}
              aria-current={
                isRouteActive(pathname, link.path) ? 'page' : undefined
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}

interface Props {
  initiallyVerified: boolean;
  isAdminAuthenticated: boolean;
  children: React.ReactNode;
}

export function StorefrontContent({
  initiallyVerified,
  isAdminAuthenticated,
  children,
}: Props) {
  const [isAgeVerified, setIsAgeVerified] = useState(initiallyVerified);
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <CartProvider>
      <div className="root-layout">
        {/* AmbientOverlay renders via portal — persists across both states */}
        <AmbientOverlay />
        <div id="ambient-portal" />

        {!isAgeVerified ? (
          <div className="age-gate-screen">
            <AgeGate onVerified={() => setIsAgeVerified(true)} />
          </div>
        ) : (
          <>
            <Navigation isAdminAuthenticated={isAdminAuthenticated} />
            <DesktopModal />
            <div className="content-wrapper">{children}</div>
          </>
        )}
      </div>
    </CartProvider>
  );
}
