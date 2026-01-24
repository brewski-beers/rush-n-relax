export function Locations() {
  return (
    <div className="page page-static">
      <div className="page-hero">
        <h1>Built to Scale Locations</h1>
        <p>
          From one shop to hundreds, techByBrewski keeps the same fast, reliable experience while
          separating business logic from presentation so each store can grow without rework.
        </p>
      </div>
      <div className="page-grid">
        <section>
          <h2>Store Mode & Timeclock</h2>
          <p>
            Kiosk mode with offline resilience keeps lines moving, while the same foundation can
            power employee timeclock flows—one codebase, multiple roles, zero duplicated effort.
          </p>
        </section>
        <section>
          <h2>POS & Ecommerce, Unified</h2>
          <p>
            Replace fragmented systems: POS kiosks, online ordering, and staff docs all live in one
            PWA. Add payments integration to drop ongoing vendor fees and keep control in-house.
          </p>
        </section>
        <section>
          <h2>Scale Blueprint</h2>
          <p>
            Business logic is decoupled from UI: configurable roles, locations, and catalogs mean
            onboarding the next 10 or 100 stores is configuration—not a rebuild. Auth is the source
            of truth; Firestore mirrors it so permissions, invites, and contact data stay synced.
          </p>
        </section>
        <section>
          <h2>80/20 Automation</h2>
          <p>
            Automate the busywork: staff onboarding, role changes, shift tracking, and location
            updates. Keep your 20% focused on revenue and service, and let the platform handle the
            other 80%—baked just right.
          </p>
        </section>
      </div>
    </div>
  );
}
