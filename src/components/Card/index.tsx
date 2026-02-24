import React from 'react';
import { Link as RouterLink, LinkProps as RouterLinkProps } from 'react-router-dom';
import './Card.css';

interface CardProps {
  variant?: 'product' | 'product-small' | 'location' | 'info' | 'value';
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'a';
  to?: string;
  href?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
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
  children,
  className = '',
  as: Component = 'div',
  to,
  href,
  onClick,
  style,
}: CardProps) {
  const baseClass = 'rnr-card';
  const variantClass = `rnr-card--${variant}`;
  const combinedClass = `${baseClass} ${variantClass} ${className}`.trim();

  // Render as React Router Link if 'to' is provided
  if (to) {
    return (
      <RouterLink
        to={to}
        className={combinedClass}
        style={style}
      >
        {children}
      </RouterLink>
    );
  }

  // Render as HTML anchor if 'href' is provided
  if (href) {
    return (
      <a
        href={href}
        onClick={onClick}
        className={combinedClass}
        style={style}
      >
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
      style,
    },
    children
  );
}

export default Card;
