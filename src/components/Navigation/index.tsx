import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Navigation.css';

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleNavClick = () => {
    setIsMenuOpen(false);
  };

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'About', path: '/about' },
    { label: 'Locations', path: '/locations' },
    { label: 'Contact', path: '/contact' },
  ];

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <span className="logo-text">RUSH N RELAX</span>
        </Link>

        <button
          className={`mobile-nav-toggle ${isMenuOpen ? 'active' : ''}`}
          onClick={toggleMenu}
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          aria-controls="nav-menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <nav
          id="nav-menu"
          className={`navigation ${isMenuOpen ? 'active' : ''}`}
          aria-label="Main navigation"
        >
          <ul>
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  onClick={handleNavClick}
                  className="nav-link"
                  aria-current={
                    window.location.pathname === link.path ? 'page' : undefined
                  }
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
