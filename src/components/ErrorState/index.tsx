import React from 'react';

interface ErrorStateProps {
  error: Error;
  onRetry?: () => void;
  showDetails?: boolean;
}

/**
 * ErrorState Component
 * 
 * Standardized error UI across the application.
 * Provides user-friendly error messages and retry actions.
 */
export function ErrorState({ error, onRetry, showDetails = false }: ErrorStateProps) {
  const errorMessage = 'message' in error ? error.message : 'An unexpected error occurred';
  
  return (
    <div className="error-state">
      <div className="error-state-icon">⚠️</div>
      <h3 className="error-state-title">Something went wrong</h3>
      <p className="error-state-description">{errorMessage}</p>
      
      {showDetails && error.stack && (
        <details className="error-state-details">
          <summary>Technical Details</summary>
          <pre>{error.stack}</pre>
        </details>
      )}
      
      {onRetry && (
        <button onClick={onRetry} className="cta">
          Try Again
        </button>
      )}
    </div>
  );
}

/**
 * Network Error State
 */
export function NetworkErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="error-state">
      <div className="error-state-icon">📡</div>
      <h3 className="error-state-title">Connection Error</h3>
      <p className="error-state-description">
        Unable to connect to the server. Please check your internet connection.
      </p>
      {onRetry && (
        <button onClick={onRetry} className="cta">
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Not Found Error State
 */
export function NotFoundErrorState() {
  return (
    <div className="error-state">
      <div className="error-state-icon">🔍</div>
      <h3 className="error-state-title">Page Not Found</h3>
      <p className="error-state-description">
        The page you're looking for doesn't exist.
      </p>
      <a href="/" className="cta">
        Go Home
      </a>
    </div>
  );
}
