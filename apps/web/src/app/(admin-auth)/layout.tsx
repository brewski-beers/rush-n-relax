import { AmbientOverlay } from '@/components/AmbientOverlay';
import '@/styles/admin.css';

export default function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="staff-entry-viewport">
      <AmbientOverlay />
      <div id="ambient-portal" />
      <main className="staff-entry-stage">{children}</main>
    </div>
  );
}
