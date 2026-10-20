# Лаба 8 — frontend (React/Vite), многоэтапная сборка

# Этап 1: сборка SPA
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Этап 2: раздача статики через Nginx + reverse-proxy на backend
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# SPA-fallback + прокси /api и /socket.io (WS-upgrade) — см. nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
