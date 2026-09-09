# --- build & runtime ---
FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=8080
ENV ASTROLAB_DB_PATH=/data/astrolab.json

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 8080
VOLUME ["/data"]

CMD ["node", "src/server.mjs"]
