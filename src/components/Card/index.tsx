import React from 'react';
import Link from 'next/link';
import './Card.css';

interface CardProps {
  variant?: 'product' | 'product-small' | 'location' | 'info' | 'value';
  surface?: 'stable' | 'anchor';
  elevation?: 'none' | 'soft';
  motion?: boolean;
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'a';
  to?: string;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Standardized Rush N Relax Card Component
 *
 * Uses a unified design system with consistent spacing, sizing, and behavior.
 * Variants provide semantic meaning while maintaining visual consistency.
 *
 * Variants:
 * - 'product': Full product card with image, content (Products page)
 * - 'product-small': Compact product card (Related products)
 * - 'location': Location info card (Locations page)
 * - 'info': Information card for hours, contact, etc
 * - 'value': Value proposition card (About page)
 *
 * Props:
 * - to: React Router path (internal navigation)
 * - href: HTML anchor href (external links)
 * - as: HTML element type ('div', 'article', 'a')
 */
export function Card({
  variant = 'product',
  surface = 'stable',
  elevation = 'none',
  motion = false,
  children,
  className = '',
  as: Component = 'div',
  to,
  href,
  onClick,
}: CardProps) {
  const baseClass = 'rnr-card';
  const variantClass = `rnr-card--${variant}`;
  const surfaceClass = `rnr-card--surface-${surface}`;
  const legacySurfaceClass = `rnr-card--${surface}`;
  const elevationClass = `rnr-card--elevation-${elevation}`;
  const motionClass = motion ? 'rnr-card--motion' : '';
  const combinedClass =
    `${baseClass} ${variantClass} ${surfaceClass} ${legacySurfaceClass} ${elevationClass} ${motionClass} ${className}`.trim();

  if (to) {
    return (
      <Link href={to} className={combinedClass}>
        {children}
      </Link>
    );
  }

  // Render as HTML anchor if 'href' is provided
  if (href) {
    return (
      <a href={href} onClick={onClick} className={combinedClass}>
        {children}
      </a>
    );
  }

  // Render as specified element type (div, article, etc)
  return React.createElement(
    Component,
    {
      onClick,
      className: combinedClass,
    },
    children
  );
}

export default Card;
