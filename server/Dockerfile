FROM node:20-alpine
WORKDIR /app

# Install system dependencies if required for native modules
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Create uploads directory with permissions
RUN mkdir -p uploads && chmod 777 uploads

ENV NODE_ENV=production
ENV PORT=5005

EXPOSE 5005

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3   CMD wget --no-verbose --tries=1 --spider http://localhost:5005/api/server/health/python || exit 1

CMD ["node", "index.js"]
