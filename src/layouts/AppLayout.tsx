import { Outlet, ScrollRestoration } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AmbientOverlay } from '@/components/AmbientOverlay';

/**
 * App Layout - Main application layout with persistent navigation
 * 
 * Responsibilities:
 * - Renders Header (persistent across page navigation)
 * - Renders main content area
 * - Renders Footer (persistent across page navigation)
 * - Manages scroll restoration between routes
 * 
 * This layout is used for public-facing pages (home, products, etc.)
 * Header and Footer only mount once, preventing unnecessary re-renders.
 */
export function AppLayout() {
  return (
    <div className="app-layout">
      <AmbientOverlay />
      <Header />
      <main className="main-content">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
