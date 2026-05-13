import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { HelmetProvider } from 'react-helmet-async';
import { TenantProvider } from './contexts/TenantContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <TenantProvider>
        <App />
      </TenantProvider>
    </HelmetProvider>
  </React.StrictMode>,
);
