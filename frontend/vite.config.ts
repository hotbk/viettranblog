import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: true,
    proxy: {
      '/api': {
        // Overridable for local runs where the default port is occupied by another
        // service on the host (e.g. a shared dev box). Defaults unchanged.
        target: process.env.VITE_BACKEND_URL || 'http://localhost:18080',
        changeOrigin: true,
      },
      // sitemap.xml must be served at the site root per the sitemap protocol (a sitemap can
      // only list URLs at or below its own path). The generator lives in the backend at
      // /api/sitemap.xml; production nginx needs the equivalent proxy rule — see
      // docs/07-deployment-guide.md.
      '/sitemap.xml': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:18080',
        changeOrigin: true,
        rewrite: () => '/api/sitemap.xml',
      },
    },
  },
});
