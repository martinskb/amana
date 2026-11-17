/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,png,woff2}'] },
      manifest: {
        name: 'Amana',
        short_name: 'Amana',
        lang: 'pt-BR',
        display: 'standalone',
        start_url: '/',
        background_color: '#121012',
        theme_color: '#121012',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    env: { TZ: 'UTC' },
  },
});
