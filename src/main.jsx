import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './context/AppContext';
import './styles/theme.css';

// HashRouter (not BrowserRouter) — GitHub Pages serves static files with no
// server-side rewrites, so path-based routes 404 on refresh/direct link.
// Hash routes (e.g. /#/dashboard/xyz) always resolve to index.html.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </HashRouter>
  </React.StrictMode>
);
