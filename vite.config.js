import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/dify-api': {
        target: 'https://api.dify.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dify-api/, '')
      }
    }
  }
})