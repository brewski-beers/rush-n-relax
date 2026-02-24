import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function About() {
  useEffect(() => {
    document.title = 'About Rush N Relax — Our Story, Values & Team';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Meet the team behind Rush N Relax. Learn how two East Tennessee natives built a premium cannabis dispensary and speakeasy-style lounge across Oak Ridge, Maryville, and Seymour.'
      );
    }
  }, []);

  return (
    <main className="about-page">
        <section id="about-hero" className="about-hero">
          <div className="container">
            <h1>About Rush N Relax</h1>
            <p className="lead">
              Two East Tennessee natives. Three dispensaries. One
              relentless standard — every visit should feel as good
              as what you take home.
            </p>
          </div>
        </section>

        <section id="mission" className="mission">
          <div className="container">
            <h2>Why We Exist</h2>
            <p>
              Rush N Relax was founded on a simple observation: most
              cannabis retail feels transactional. You walk in, grab a
              product, and leave. We thought the experience deserved more.
              More care in what we stock, more knowledge behind the
              counter, and more atmosphere when you step through the door.
            </p>
            <p>
              That conviction led to our first location in Oak Ridge —
              anchored by a speakeasy-style lounge where the experience
              doesn't end at the register. It carried over into Maryville
              and Seymour, where our premium retail format brings the same
              curated selection and attentive service to Blount and Sevier
              counties.
            </p>
            <p>
              Every product on our shelves — flower, concentrates, edibles,
              vapes, and THCa-infused drinks — is hand-selected, lab-tested,
              and held to a standard we'd stake our name on. Because we do.
            </p>
          </div>
        </section>

        <section id="values" className="values">
          <div className="container">
            <h2>What We Stand For</h2>
            <div className="values-grid">
              <div className="value-card">
                <h3>Quality Without Compromise</h3>
                <p>
                  We taste, test, and vet every product before it reaches the
                  shelf. If it doesn't meet our standard, it doesn't make
                  the cut — regardless of margin or trend.
                </p>
              </div>
              <div className="value-card">
                <h3>Respect for the Plant & the Person</h3>
                <p>
                  Cannabis means different things to different people. We
                  meet every customer where they are — first-timer or
                  seasoned enthusiast — with honest guidance and zero
                  judgment.
                </p>
              </div>
              <div className="value-card">
                <h3>Experience Over Everything</h3>
                <p>
                  The lounge, the conversation, the product recommendation
                  that lands perfectly — we obsess over the details that
                  turn a transaction into a moment worth remembering.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="team" className="team">
          <div className="container">
            <h2>Leadership</h2>
            <p className="text-secondary" style={{ marginBottom: '2rem' }}>
              Rush N Relax is co-founded by John Rush and Michael Capps —
              East Tennessee natives who saw an opportunity to raise the bar
              for cannabis retail in their own community.
            </p>
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

        <section id="experience" className="experience-section">
          <div className="container">
            <h2>The Speakeasy Lounge</h2>
            <p>
              Our Oak Ridge flagship is more than a dispensary — it's a
              destination. The speakeasy-style lounge offers a refined space
              to slow down, explore new products, and enjoy the moment in
              good company. Dim lighting, curated ambiance, and a staff that
              knows every strain on the shelf. It's the experience that put
              Rush N Relax on the map.
            </p>
            <Link to="/locations/oak-ridge" className="link-arrow">
              Visit the Oak Ridge Lounge →
            </Link>
          </div>
        </section>

        <section id="cta" className="about-cta">
          <div className="container">
            <h2>Come See for Yourself</h2>
            <p>
              Three locations across East Tennessee, open seven days a week.
              Walk in anytime — we'll take it from there.
            </p>
            <Link to="/locations" className="btn">
              Find a Location
            </Link>
          </div>
        </section>
    </main>
  );
}
