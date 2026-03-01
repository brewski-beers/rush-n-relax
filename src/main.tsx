import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import './styles/index.css';

const ASSET_RECOVERY_TS_KEY = 'rnr-asset-recovery-ts';
const ASSET_RECOVERY_COOLDOWN_MS = 30_000;

function shouldAttemptAssetRecovery(): boolean {
  try {
    const lastAttempt = Number(
      sessionStorage.getItem(ASSET_RECOVERY_TS_KEY) || 0
    );
    if (Date.now() - lastAttempt < ASSET_RECOVERY_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(ASSET_RECOVERY_TS_KEY, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  if (shouldAttemptAssetRecovery()) {
    window.location.reload();
  }
});

window.addEventListener('unhandledrejection', event => {
  const reason =
    typeof event.reason === 'string'
      ? event.reason
      : (event.reason as Error | undefined)?.message || '';

  if (
    reason.includes('Unable to preload CSS') ||
    reason.includes('Failed to fetch dynamically imported module') ||
    reason.includes('Loading chunk')
  ) {
    event.preventDefault();
    if (shouldAttemptAssetRecovery()) {
      window.location.reload();
    }
  }
});

const root = document.getElementById('root');

if (!root) {
  throw new Error(
    'Root element not found in DOM. Check index.html for <div id="root"></div>'
  );
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <RootLayout />
    </BrowserRouter>
  </React.StrictMode>
);
