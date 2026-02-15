import { ReactNode } from 'react';

interface CardGridProps {
  children: ReactNode;
  columns?: 'auto' | '2' | '3' | '4';
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CardGrid({ children, columns = 'auto', gap = 'md', className = '' }: CardGridProps) {
  const gapMap = {
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
  };

  const columnMap = {
    auto: 'auto-fit',
    '2': '2',
    '3': '3',
    '4': '4',
  };

  const colValue = columnMap[columns];
  const gridTemplateColumns = columns === 'auto' 
    ? 'repeat(auto-fit, minmax(300px, 1fr))'
    : `repeat(${colValue}, 1fr)`;

  return (
    <div
      className={`card-grid ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap: gapMap[gap],
        width: '100%',
      }}
    >
      {children}
    </div>
  );
}
