import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Прокси-цель dev-бэкенда: в контейнере — имя сервиса compose (VITE_PROXY_TARGET),
// на хосте — локальный сервер (дефолт). Используется только при vite dev (не при build).
const apiTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: true, // слушать 0.0.0.0 — нужно внутри контейнера
    port: 5173,
    strictPort: true,
    // Относительный /api и сокет → backend; в контейнере цель переопределяется env'ом
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/socket.io': { target: apiTarget, changeOrigin: true, ws: true },
    },
  },
})
