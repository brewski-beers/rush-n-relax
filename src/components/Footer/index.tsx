import './Footer.css';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <section className="footer-section">
          <h3>RUSH N RELAX</h3>
          <p>Upscale cannabis dispensary and speakeasy-style lounge experience.</p>
        </section>

        <section className="footer-section">
          <h3>Locations</h3>
          <ul className="footer-list">
            <li>
              <a href="#locations" title="View all locations">
                Multiple locations
              </a>
            </li>
            <li>
              <a href="tel:+1234567890">Call locations</a>
            </li>
            <li>
              <span>7 days a week</span>
            </li>
          </ul>
        </section>

        <section className="footer-section">
          <h3>Contact</h3>
          <ul className="footer-list">
            <li>
              <a href="mailto:rush@rushnrelax.com">rush@rushnrelax.com</a>
            </li>
            <li>
              <a href="mailto:capps@rushnrelax.com">capps@rushnrelax.com</a>
            </li>
            <li>
              <a href="/contact">Contact form</a>
            </li>
          </ul>
        </section>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Rush N Relax. All rights reserved.</p>
        <p>
          <small>Must be 21+ years of age to visit.</small>
        </p>
      </div>
    </footer>
  );
}
