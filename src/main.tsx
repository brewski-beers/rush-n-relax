import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import './styles/reset.css';
import './styles/containers.css';
import './styles/mobile-base.css';
import './styles/responsive.css';
import './styles/typography.css';
import './styles/utilities.css';
import './styles/accessibility.css';

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
