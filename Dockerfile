FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV DATABASE_URL=file:/data/rxlumen.db
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build && npm run licenses && chown -R node:node /app && mkdir -p /data && chown node:node /data
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_URL=file:/data/rxlumen.db
EXPOSE 3000
USER node
CMD ["sh", "-c", "npm run db:deploy && npm start"]
