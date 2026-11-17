FROM node:22-alpine

WORKDIR /app

RUN echo "[docker] build context contents:" && ls -la

COPY package.json package-lock.json ./

RUN echo "[docker] /app contents before npm ci:" && ls -la

RUN npm ci

COPY . .

RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
