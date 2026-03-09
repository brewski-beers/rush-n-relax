'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { useNavigation } from '@/contexts/useNavigation';
import { AmbientOverlay } from '@/components/AmbientOverlay';
import { AgeGate } from '@/components/AgeGate';
import { Navigation } from '@/components/Navigation';
import { isRouteActive } from '@/utils/routeMatching';

const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Locations', path: '/locations' },
  { label: 'Products', path: '/products' },
  { label: 'Contact', path: '/contact' },
] as const;

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
  }, [isMenuOpen, setIsMenuOpen]);

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

function StorefrontContent({ children }: { children: React.ReactNode }) {
  const [isAgeVerified, setIsAgeVerified] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null;
    const verified = localStorage.getItem('ageVerified');
    return verified === null ? null : verified === 'true';
  });
  const pathname = usePathname();

  useEffect(() => {
    const handleAgeVerified = () => setIsAgeVerified(true);
    window.addEventListener('ageVerified', handleAgeVerified);
    return () => window.removeEventListener('ageVerified', handleAgeVerified);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="root-layout">
      {/* AmbientOverlay renders via portal — persists across both states */}
      <AmbientOverlay />
      <div id="ambient-portal" />

      {!isAgeVerified ? (
        <div className="age-gate-screen">
          <AgeGate />
        </div>
      ) : (
        <>
          <Navigation />
          <DesktopModal />
          <div className="content-wrapper">{children}</div>
        </>
      )}
    </div>
  );
}

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NavigationProvider>
      <StorefrontContent>{children}</StorefrontContent>
    </NavigationProvider>
  );
}
