import { SOCIAL_LINKS, TECH_CREDIT, isSocialIconObject } from '../../constants/social';
import './Footer.css';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Branding */}
        <div className="footer-brand">
          <h3>RUSH N RELAX</h3>
          <p className="footer-tagline">Premium cannabis experience</p>
        </div>

        {/* Social Links */}
        {SOCIAL_LINKS.length > 0 && (
          <div className="footer-social">
            {SOCIAL_LINKS.map((social) => {
              return (
                <a
                  key={social.id}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.ariaLabel}
                  className="social-icon"
                  title={social.name}
                >
                  {isSocialIconObject(social.icon) ? (
                    <img src={social.icon.src} alt={social.icon.alt} className="social-icon-img" />
                  ) : (
                    social.icon
                  )}
                </a>
              );
            })}
          </div>
        )}

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <p className="copyright">
            &copy; {new Date().getFullYear()} Rush N Relax
          </p>
          <p className="tech-credit">
            <a href={TECH_CREDIT.url} target="_blank" rel="noopener noreferrer">
              Tech by Brewski
            </a>
          </p>
          <p className="legal">
            <small>Must be 21+ to visit</small>
          </p>
        </div>
      </div>
    </footer>
  );
}
