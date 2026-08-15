import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 👇 新增这段代理配置：搭建本地前后端桥梁
    proxy: {
      '/api': {
        target: 'http://localhost:3005', // 👈 改成 3005 避开幽灵进程
        changeOrigin: true,
      }
    }
  }
})