import { ReactNode } from 'react';
import './CardGrid.css';

interface CardGridProps {
  children: ReactNode;
  columns?: 'auto' | '2' | '3' | '4';
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function CardGrid({
  children,
  columns = 'auto',
  gap = 'md',
  className = '',
}: CardGridProps) {
  const gapClass = `card-grid--gap-${gap}`;
  const colsClass = `card-grid--cols-${columns}`;

  return (
    <div className={`card-grid ${gapClass} ${colsClass} ${className}`.trim()}>
      {children}
    </div>
  );
}
