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
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/oauth': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/.well-known': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: '../dist/admin',
    emptyOutDir: true
  }
})
