import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  cacheDir: '../node_modules/.vite/admin',
  plugins: [react()],
  optimizeDeps: {
    include: ['@monaco-editor/react', 'monaco-editor'],
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: process.env.NEXUSID_ADMIN_API_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
      // Anchored so the SPA route /authentication is not proxied to the API.
      '^/auth(/|$)': {
        target: process.env.NEXUSID_ADMIN_API_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
      '/oauth': {
        target: process.env.NEXUSID_ADMIN_API_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
      '/media': {
        target: process.env.NEXUSID_ADMIN_API_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
      '/.well-known': {
        target: process.env.NEXUSID_ADMIN_API_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: '../dist/admin',
    emptyOutDir: true
  }
})
