import React from 'react';
import { useNavigate } from 'react-router-dom';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * EmptyState Component
 * 
 * Standardized empty state UI across the application.
 * Provides clear user guidance when no content is available.
 */
export function EmptyState({ icon = '📦', title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="cta">
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * No Products Empty State
 */
export function NoProductsEmptyState() {
  const navigate = useNavigate();
  
  return (
    <EmptyState
      icon="🌿"
      title="No products available"
      description="Check back soon for new arrivals"
      action={{
        label: 'Browse Categories',
        onClick: () => navigate('/'),
      }}
    />
  );
}

/**
 * No Search Results Empty State
 */
export function NoSearchResultsEmptyState() {
  return (
    <EmptyState
      icon="🔍"
      title="No products match your search"
      description="Try different keywords or browse all products"
    />
  );
}

/**
 * Cart Empty State
 */
export function CartEmptyState() {
  const navigate = useNavigate();
  
  return (
    <EmptyState
      icon="🛒"
      title="Your cart is empty"
      description="Add some products to get started"
      action={{
        label: 'Start Shopping',
        onClick: () => navigate('/'),
      }}
    />
  );
}
