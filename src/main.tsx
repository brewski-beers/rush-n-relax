import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import './styles/index.css';

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
