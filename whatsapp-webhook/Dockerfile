# Lightweight WhatsApp webhook for Suraksha LMS — Cloud Run ready.
FROM node:20-slim

# Cloud Run sets PORT (default 8080) and the app must listen on it.
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

# Install production deps first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App source.
COPY . .

# Run as the non-root user shipped with the node image.
USER node

EXPOSE 8080

CMD ["node", "index.js"]
