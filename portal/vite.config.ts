import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.NEXUSID_PORTAL_BASE ?? '/portal/',
  cacheDir: '../node_modules/.vite/portal',
  plugins: [react()],
  server: {
    port: 5200,
    proxy: {
      '/api': { target: process.env.NEXUSID_PORTAL_API_ORIGIN ?? 'http://localhost:4000', changeOrigin: true },
      '/auth': { target: process.env.NEXUSID_PORTAL_API_ORIGIN ?? 'http://localhost:4000', changeOrigin: true },
      '/media': { target: process.env.NEXUSID_PORTAL_API_ORIGIN ?? 'http://localhost:4000', changeOrigin: true },
    }
  },
  build: {
    outDir: '../dist/portal',
    emptyOutDir: true
  }
})
