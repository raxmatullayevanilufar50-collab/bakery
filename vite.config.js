import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // manifest.json — public/ ichida qo'lda yozilgan (Non Tizimi branding
    // bilan), shuning uchun bu plagin o'zining manifestini generatsiya
    // qilmaydi (manifest: false) — faqat build assetlarini keshlaydigan
    // service worker'ni yaratadi.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
})
