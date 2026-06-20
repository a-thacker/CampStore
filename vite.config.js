import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During local dev run `npm run netlify` (netlify dev) so /.netlify/functions/*
// is served alongside Vite. If you use plain `npm run dev`, point the proxy
// below at a running `netlify functions:serve` (default port 9999).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:9999',
        changeOrigin: true,
      },
    },
  },
});
