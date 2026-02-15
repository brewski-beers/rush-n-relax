import { useEffect } from 'react';

export default function About() {
  useEffect(() => {
    document.title = 'About Us - Rush N Relax';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Learn about Rush N Relax, our mission, and our commitment to premium cannabis experiences.'
      );
    }
  }, []);

  return (
    <main className="about-page">
        <section id="about-hero" className="about-hero">
          <div className="container">
            <h1>About Rush N Relax</h1>
            <p className="lead">
              We believe cannabis is more than just a product — it's an experience.
            </p>
          </div>
        </section>

        <section id="mission" className="mission">
          <div className="container">
            <h2>Our Mission</h2>
            <p>
              At Rush N Relax, we are dedicated to providing a premium cannabis
              experience that celebrates the plant and respects our community.
              Every product is carefully curated to meet our exacting standards of
              quality, safety, and excellence.
            </p>
            <p>
              Our upscale dispensary and speakeasy-style lounge create an
              inviting atmosphere where you can explore, learn, and enjoy an
              exceptional cannabis experience.
            </p>
          </div>
        </section>

        <section id="values" className="values">
          <div className="container">
            <h2>Our Values</h2>
            <div className="values-grid">
              <div className="value-card">
                <h3>Quality</h3>
                <p>
                  We source only the finest products from trusted partners and
                  apply rigorous quality standards to everything we offer.
                </p>
              </div>
              <div className="value-card">
                <h3>Respect</h3>
                <p>
                  We respect the plant, our community, and each individual's
                  journey. We prioritize responsible consumption.
                </p>
              </div>
              <div className="value-card">
                <h3>Experience</h3>
                <p>
                  We create memorable experiences by combining premium products
                  with expert guidance and a welcoming atmosphere.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="team" className="team">
          <div className="container">
            <h2>Leadership</h2>
            <div className="team-grid">
              <div className="team-member">
                <h3>John Rush</h3>
                <p className="role">Co-Founder</p>
                <a href="mailto:rush@rushnrelax.com">rush@rushnrelax.com</a>
              </div>
              <div className="team-member">
                <h3>Michael Capps</h3>
                <p className="role">Co-Founder</p>
                <a href="mailto:capps@rushnrelax.com">capps@rushnrelax.com</a>
              </div>
            </div>
          </div>
        </section>

        <section id="cta" className="about-cta">
          <div className="container">
            <h2>Ready to Experience More?</h2>
            <p>Visit one of our premium locations today.</p>
            <a href="/locations" className="btn">
              Find a Location
            </a>
          </div>
        </section>
    </main>
  );
}
