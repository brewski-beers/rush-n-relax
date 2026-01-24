export function About() {
  return (
    <div className="page page-static">
      <div className="page-hero">
        <h1>Why This PWA Matters</h1>
        <p>Purpose-built to feel instant, reliable, and premium—far beyond a brochure site.</p>
      </div>
      <div className="page-grid">
        <section>
          <h2>Engineered for Speed</h2>
          <p>
            Pre-cached critical paths, optimized bundles, and smart image loading keep the app
            fast—even on spotty networks. Customers feel the app, not the page reloads.
          </p>
        </section>
        <section>
          <h2>Built for Trust</h2>
          <ul>
            <li>Secure auth with role-based controls for staff, managers, and admins</li>
            <li>Offline-ready patterns so carts and content don’t vanish</li>
            <li>Consistent data between Auth and Firestore to avoid drift</li>
          </ul>
        </section>
        <section>
          <h2>Conversion-Ready</h2>
          <ul>
            <li>Lightning-fast navigation for lower bounce and higher intent</li>
            <li>Structured product data for future SEO and app store listings</li>
            <li>Session handling and activity tracking tuned for real-world use</li>
          </ul>
        </section>
        <section>
          <h2>User Management, Proven</h2>
          <ul>
            <li>Staff/manager/admin hierarchy with audit trails on role changes</li>
            <li>Customer self-service for profile + display name; staff can assist when needed</li>
            <li>Auth is the source of truth; Firestore mirrors updates to prevent drift</li>
          </ul>
        </section>
        <section>
          <h2>Product Operations</h2>
          <ul>
            <li>Visibility toggles per product/category for web and kiosk contexts</li>
            <li>Inventory hooks ready for real-time stock; safe projections for public views</li>
            <li>Variant-ready data model so scaling SKUs doesn’t require rewrites</li>
          </ul>
        </section>
        <section>
          <h2>Auth & Compliance</h2>
          <ul>
            <li>Session timeout by role; token revocation flows to reduce risk</li>
            <li>Custom claims drive UI and access—not fragile client flags</li>
            <li>Future-ready for age/ID checks and SSO if required</li>
          </ul>
        </section>
        <section>
          <h2>Proof-of-Concept Ideas</h2>
          <ul>
            <li>Role-aware dashboards (staff sees tasks, managers see ops, admins see performance)</li>
            <li>Kiosk + POS-lite with cart handoff to customer devices</li>
            <li>Automated staff onboarding: invites, claim setting, and quick provisioning</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
