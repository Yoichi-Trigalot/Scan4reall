import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // The dictionary (~1.8 MB) must work offline, while travelling
        globPatterns: ['**/*.{js,css,html,png,svg,txt}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'Scan4reall',
        short_name: 'Scan4reall',
        description: 'Numérisation fidèle de livres papier pour liseuse',
        lang: 'fr',
        display: 'standalone',
        background_color: '#1f2a44',
        theme_color: '#1f2a44',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
