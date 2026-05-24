import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  appType: 'spa',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://projecthub-a8ih.onrender.com',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'https://projecthub-a8ih.onrender.com',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})