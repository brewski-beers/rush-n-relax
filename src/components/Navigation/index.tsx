import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import {
  BrandAssetFormat,
  BrandSurface,
  resolvePreferredLogoUrlForSurface,
} from '../../constants/branding';
import { isRouteActive } from '../../utils/routeMatching';
import cannabisLeaf from '../../assets/icons/cannabis-leaf.svg';
import './Navigation.css';

export function Navigation() {
  const { isMenuOpen, toggleMenu } = useNavigation();
  const location = useLocation();
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

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
        BrandAssetFormat.PNG,
      );
      if (isMounted) {
        setLogoSrc(url);
      }
    };

    loadLogo();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
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

        <button
          className={`nav-toggle ${isMenuOpen ? 'active' : ''}`}
          onClick={toggleMenu}
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          aria-controls="nav-menu"
        >
          <img src={cannabisLeaf} alt="" className="cannabis-leaf-icon" />
        </button>

        {/* Mobile Menu Drawer */}
        <nav
          className={`mobile-drawer ${isMenuOpen ? 'active' : ''}`}
          aria-label="Mobile navigation"
        >
          {/* Navigation Links */}
          <ul className="nav-links">
            {[
              { label: 'Home', path: '/' },
              { label: 'About', path: '/about' },
              { label: 'Locations', path: '/locations' },
              { label: 'Products', path: '/products' },
              { label: 'Contact', path: '/contact' },
            ].map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  onClick={() => toggleMenu()}
                  className="nav-link"
                  aria-current={isRouteActive(location.pathname, link.path) ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
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
