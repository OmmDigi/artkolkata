# ------------------------
# Stage 1: Build
# ------------------------
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ------------------------
# Stage 2: Runtime
# ------------------------
FROM node:18-alpine
WORKDIR /app

# Default to production install
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

COPY package*.json ./

# Install deps depending on NODE_ENV
RUN if [ "$NODE_ENV" = "development" ]; then npm install; else npm ci --only=production; fi

COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]