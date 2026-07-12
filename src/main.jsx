import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import StockStation from './StockStation.jsx';
import './index.css';

// Simple path-based routing: /stock opens the QR-friendly Stock Station,
// everything else is the full register. Netlify's SPA redirect serves
// index.html for /stock so a deep link / QR works.
const isStock = window.location.pathname.replace(/\/+$/, '').endsWith('/stock');

createRoot(document.getElementById('root')).render(isStock ? <StockStation /> : <App />);
