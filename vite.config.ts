import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Rush n Relax',
        short_name: 'RnR',
        description: 'Cannabis retail PWA',
        theme_color: '#2c5f2d',
        background_color: '#ffffff',
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firestore-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'ES2020',
    minify: 'terser',
  },
  server: {
    port: 3000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
  },
});