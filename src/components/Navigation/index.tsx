'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { signOut } from 'firebase/auth';
import { initializeApp } from '@/firebase';
import { useNavigation } from '../../contexts/useNavigation';
import {
  BrandAssetFormat,
  BrandSurface,
  resolvePreferredLogoUrlForSurface,
} from '../../constants/branding';
import { getAssetSrc } from '../../utils/assetSrc';
import { isRouteActive } from '../../utils/routeMatching';
import cannabisLeaf from '../../assets/icons/cannabis-leaf.svg';
import './Navigation.css';

const CANNABIS_LEAF_ICON_SRC = getAssetSrc(cannabisLeaf);
const ADMIN_ENTRY_HOLD_MS = 4200;

const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Locations', path: '/locations' },
  { label: 'Products', path: '/products' },
  { label: 'Contact', path: '/contact' },
] as const;

interface NavigationProps {
  isAdminAuthenticated?: boolean;
}

export function Navigation({ isAdminAuthenticated = false }: NavigationProps) {
  const { isMenuOpen, toggleMenu } = useNavigation();
  const pathname = usePathname();
  const router = useRouter();
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const holdTimerRef = useRef<number | null>(null);
  const holdTriggeredRef = useRef(false);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handlePressStart = () => {
    if (isAdminAuthenticated) return;

    holdTriggeredRef.current = false;
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdTriggeredRef.current = true;
      router.push('/admin');
    }, ADMIN_ENTRY_HOLD_MS);
  };

  const handlePressEnd = () => {
    clearHoldTimer();
  };

  const handleToggleClick = () => {
    if (holdTriggeredRef.current) {
      holdTriggeredRef.current = false;
      return;
    }

    toggleMenu();
  };

  const handleLogout = () => {
    startLogoutTransition(async () => {
      const { auth } = initializeApp();
      if (auth) await signOut(auth);
      await fetch('/api/auth/session', { method: 'DELETE' });
      router.push('/admin/login');
      router.refresh();
    });
  };

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMenuOpen]);

  useEffect(() => {
    let isMounted = true;

    const loadLogo = async () => {
      const url = await resolvePreferredLogoUrlForSurface(
        BrandSurface.HEADER_DESKTOP,
        BrandAssetFormat.PNG
      );
      if (isMounted) {
        setLogoSrc(url);
      }
    };

    void loadLogo();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      clearHoldTimer();
    };
  }, []);

  return (
    <header className="header">
      <div className="header-content">
        <Link href="/" className="logo">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt="Rush N Relax"
              className="logo-image"
              onError={() => setLogoSrc(null)}
            />
          ) : (
            <span className="logo-text">RUSH N RELAX</span>
          )}
        </Link>

        <p className="header-legal" aria-label="Age requirement">
          21+ only
        </p>

        {isAdminAuthenticated ? (
          <div className="admin-shortcuts" aria-label="Admin shortcuts">
            <Link href="/admin/dashboard" className="admin-shortcut-link">
              ADMIN
            </Link>
            <button
              type="button"
              className="admin-shortcut-link admin-shortcut-button"
              onClick={() => {
                handleLogout();
              }}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'LOGGING OUT' : 'LOGOUT'}
            </button>
          </div>
        ) : null}

        <button
          className={`nav-toggle ${isMenuOpen ? 'active' : ''}`}
          onClick={handleToggleClick}
          onPointerDown={handlePressStart}
          onPointerUp={handlePressEnd}
          onPointerCancel={handlePressEnd}
          onPointerLeave={handlePressEnd}
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          aria-controls="nav-menu"
        >
          {CANNABIS_LEAF_ICON_SRC ? (
            <img
              src={CANNABIS_LEAF_ICON_SRC}
              alt=""
              className="cannabis-leaf-icon"
            />
          ) : (
            <span className="cannabis-leaf-icon" aria-hidden="true">
              🌿
            </span>
          )}
        </button>

        {/* Mobile Menu Drawer */}
        <nav
          className={`mobile-drawer ${isMenuOpen ? 'active' : ''}`}
          aria-label="Mobile navigation"
        >
          {/* Navigation Links */}
          <ul className="nav-links">
            {NAV_LINKS.map((link, index) => (
              <li key={link.path}>
                <Link
                  href={link.path}
                  onClick={() => toggleMenu()}
                  className={`nav-link${index === Math.floor(NAV_LINKS.length / 2) ? ' nav-link--center' : ''}`}
                  aria-current={
                    isRouteActive(pathname, link.path) ? 'page' : undefined
                  }
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {isAdminAuthenticated ? (
              <li>
                <Link
                  href="/admin/dashboard"
                  onClick={() => toggleMenu()}
                  className="nav-link"
                >
                  ADMIN
                </Link>
              </li>
            ) : null}
            {isAdminAuthenticated ? (
              <li>
                <button
                  type="button"
                  className="nav-link nav-link-button"
                  onClick={() => {
                    toggleMenu();
                    handleLogout();
                  }}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? 'LOGGING OUT' : 'LOGOUT'}
                </button>
              </li>
            ) : null}
          </ul>

          {/* Mobile Menu Hub - Only visible on mobile */}
          <div className="mobile-menu-hub">
            {/* Legal */}
            <div className="hub-legal">
              <small>Must be 21+ years of age to visit.</small>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
