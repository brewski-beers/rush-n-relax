import { type ReactNode } from 'react';

interface HeroProps {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}

export function Hero({ title = 'Shop by Category', subtitle, children }: HeroProps) {
  return (
    <section className="hero grain-soft">
      <h1>{title}</h1>
      {subtitle && <p className="tagline">{subtitle}</p>}
      {children && <div className="hero-content">{children}</div>}
    </section>
  );
}
