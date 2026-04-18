import Link from 'next/link';

const FDA_DISCLAIMER =
  'These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.';

const SITE_LINKS = [{ label: 'Our Vendors', href: '/vendors' }] as const;

const LEGAL_LINKS = [
  { label: 'Terms & Conditions', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Shipping & Returns', href: '/shipping' },
] as const;

const CURRENT_YEAR = new Date().getFullYear();

/** Visa inline SVG */
function VisaLogo() {
  return (
    <svg
      role="img"
      aria-label="Visa"
      viewBox="0 0 750 471"
      xmlns="http://www.w3.org/2000/svg"
      className="footer-card-logo"
    >
      <rect width="750" height="471" rx="40" fill="#1a1f71" />
      <path
        d="M278.2 334.1 308 136.9h49.3L327.5 334.1zm181.7-191.7c-9.8-3.7-25.1-7.7-44.2-7.7-48.7 0-83 24.7-83.3 60.1-.3 26.1 24.5 40.7 43.2 49.4 19.2 8.9 25.6 14.6 25.5 22.6-.1 12.2-15.3 17.8-29.4 17.8-19.7 0-30.1-2.8-46.3-9.5l-6.3-2.9-6.9 40.7c11.5 5.1 32.7 9.5 54.7 9.7 51.6 0 85.1-24.4 85.5-62.2.2-20.7-12.9-36.5-41.2-49.5-17.2-8.4-27.7-14-27.6-22.5 0-7.5 8.9-15.6 28.2-15.6 16.1-.3 27.7 3.3 36.8 7l4.4 2.1zm127 .1h-38c-11.8 0-20.6 3.3-25.8 15.3l-73 167.3h51.6s8.4-22.5 10.3-27.4h63.1c1.5 6.4 5.9 27.4 5.9 27.4h45.6zm-60.6 118.1c4.1-10.5 19.6-51.1 19.6-51.1-.3.5 4-10.5 6.5-17.3l3.3 15.6s9.3 43.1 11.3 52.8zm-392.4-118.1-48.2 133.8-5.2-25.4C69.9 218.5 43.1 194.7 13 182.5l44 151.5 51.9-.1 77.2-197.4z"
        fill="#fff"
      />
      <path
        d="M92.4 136.9H13.8l-.6 3.6c60.9 14.9 101.2 50.9 117.9 94.2z"
        fill="#f9a533"
      />
    </svg>
  );
}

/** Mastercard inline SVG */
function MastercardLogo() {
  return (
    <svg
      role="img"
      aria-label="Mastercard"
      viewBox="0 0 152.407 108"
      xmlns="http://www.w3.org/2000/svg"
      className="footer-card-logo"
    >
      <rect width="152.407" height="108" rx="10" fill="#252525" />
      <circle cx="58.57" cy="54" r="34.57" fill="#eb001b" />
      <circle cx="93.837" cy="54" r="34.57" fill="#f79e1b" />
      <path
        d="M76.203 24.648a34.57 34.57 0 0 1 0 58.704 34.57 34.57 0 0 1 0-58.704z"
        fill="#ff5f00"
      />
    </svg>
  );
}

/** American Express inline SVG */
function AmexLogo() {
  return (
    <svg
      role="img"
      aria-label="American Express"
      viewBox="0 0 750 471"
      xmlns="http://www.w3.org/2000/svg"
      className="footer-card-logo"
    >
      <rect width="750" height="471" rx="40" fill="#2557d6" />
      <path d="M0 295v176h750V295l-58-75H58z" fill="#2557d6" />
      <path
        fill="#fff"
        d="M126 200h41l-20.5-47zm307 0h41l-20.5-47zM34 150h82l13 30 13-30h580v171H34zm61 141h27l-39-90H57l-39 90h27l7-17h36zm90 0h24V195l31 96h22l31-96v96h24v-90h-37l-25 78-25-78H185zm172 0h85v-21h-61v-16h59v-21h-59v-16h61v-21h-85zm99 0h24v-37h17l32 37h29l-35-38c16-3 26-15 26-31 0-20-14-32-37-32h-56zm24-57v-15h29c8 0 14 4 14 7 0 4-5 8-14 8zm127 57h25v-37h17l32 37h29l-35-38c16-3 26-15 26-31 0-20-14-32-37-32h-57zm25-57v-15h29c8 0 13 4 13 7 0 4-5 8-13 8zm134-33h-25l-29 33-29-33h-26l42 45-44 45h26l30-33 30 33h26l-44-45z"
      />
    </svg>
  );
}

/** Discover inline SVG */
function DiscoverLogo() {
  return (
    <svg
      role="img"
      aria-label="Discover"
      viewBox="0 0 750 471"
      xmlns="http://www.w3.org/2000/svg"
      className="footer-card-logo"
    >
      <rect width="750" height="471" rx="40" fill="#fff" />
      <path
        d="M750 295.5C618.6 390.2 441.9 448 244.8 448H0V23h750z"
        fill="#f76f20"
      />
      <circle cx="380" cy="236" r="90" fill="#f76f20" />
      <circle cx="380" cy="236" r="75" fill="#ff6600" />
      <path
        d="M90 180h40c35 0 57 20 57 56s-22 55-57 55H90zm24 21v68h16c21 0 33-12 33-34s-12-34-33-34zm141-21h-24v111h24zm39 111h-25l42-111h22l42 111h-25l-8-23h-40zm21-68l-13 46h27zm137-43h-26l-26 77-27-77h-26l41 111h24zm55 0h-24v111h24zm58 2c-7-3-15-5-24-5-24 0-38 13-38 33 0 17 9 26 30 34 15 6 20 11 20 19 0 10-8 17-20 17-9 0-18-3-27-9v25c10 4 19 6 28 6 27 0 43-14 43-37 0-18-9-28-31-36-14-5-19-10-19-18 0-8 7-14 18-14 8 0 16 2 24 7v-22z"
        fill="#fff"
      />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="site-footer" aria-label="Site footer">
      <div className="footer-container">
        <div className="footer-legal">
          <p className="footer-disclaimer">{FDA_DISCLAIMER}</p>
        </div>

        <div className="footer-cards" aria-label="Accepted payment methods">
          <VisaLogo />
          <MastercardLogo />
          <AmexLogo />
          <DiscoverLogo />
        </div>

        <nav className="footer-links" aria-label="Site navigation">
          {SITE_LINKS.map(link => (
            <Link key={link.href} href={link.href} className="footer-link">
              {link.label}
            </Link>
          ))}
        </nav>

        <nav className="footer-links" aria-label="Legal navigation">
          {LEGAL_LINKS.map(link => (
            <Link key={link.href} href={link.href} className="footer-link">
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="footer-copyright">
          &copy; {CURRENT_YEAR} Rush N Relax. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
