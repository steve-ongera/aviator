import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy all /api calls to Django backend during development
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})