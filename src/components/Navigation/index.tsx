import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { SOCIAL_LINKS, TECH_CREDIT, isSocialIconObject } from '../../constants/social';
import { useNavigation } from '../../contexts/NavigationContext';
import cannabisLeaf from '../../assets/icons/cannabis-leaf.svg';
import './Navigation.css';

export function Navigation() {
  const { isMenuOpen, toggleMenu } = useNavigation();
  const location = useLocation();

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMenuOpen]);

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <span className="logo-text">RUSH N RELAX</span>
        </Link>

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
                  aria-current={
                    location.pathname === link.path ? 'page' : undefined
                  }
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Mobile Menu Hub - Only visible on mobile */}
          <div className="mobile-menu-hub">
            {/* Branding Section */}
            <div className="hub-branding">
              <h3>RUSH N RELAX</h3>
              <p>Premium cannabis experience</p>
            </div>

            {/* Contact Section */}
            <div className="hub-contact">
              <h4>Contact</h4>
              <a href="mailto:rush@rushnrelax.com">rush@rushnrelax.com</a>
              <a href="mailto:capps@rushnrelax.com">capps@rushnrelax.com</a>
            </div>

            {/* Social Links */}
            {SOCIAL_LINKS.length > 0 && (
              <div className="hub-social">
                <h4>Follow Us</h4>
                <div className="hub-social-icons">
                  {SOCIAL_LINKS.map((social) => {
                    return (
                      <a
                        key={social.name}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={social.ariaLabel}
                        className="hub-social-icon"
                        title={social.name}
                      >
                        {isSocialIconObject(social.icon) ? (
                          <img src={social.icon.src} alt={social.icon.alt} className="hub-social-icon-img" />
                        ) : (
                          social.icon
                        )}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tech Credit */}
            <div className="hub-credit">
              <a href={TECH_CREDIT.url} target="_blank" rel="noopener noreferrer">
                Tech by Brewski
              </a>
            </div>

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
