/**
 * Admin route-segment loading UI (#438).
 *
 * Next.js renders this during server-side data fetching for any route
 * under /admin/*. Avoids the blank-screen experience on slow connections.
 */
export default function AdminLoading() {
  return (
    <div className="admin-loading" aria-busy="true" aria-live="polite">
      <div className="admin-loading__bar admin-loading__bar--title" />
      <div className="admin-loading__bar" />
      <div className="admin-loading__bar" />
      <div className="admin-loading__bar admin-loading__bar--short" />
      <span className="visually-hidden">Loading…</span>
    </div>
  );
}
