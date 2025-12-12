import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // everything under /api goes to your backend
      '/api': {
        target: 'http://localhost:4242', // your backend port
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
