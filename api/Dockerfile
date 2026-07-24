# ------------------------
# Stage 1: Build
# ------------------------
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./

# install all deps (including dev)
RUN npm ci

COPY . .

# build typescript
RUN npm run build

# ------------------------
# Stage 2: Runtime
# ------------------------
FROM node:18-alpine

WORKDIR /app

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

COPY package*.json ./

# install only production deps
RUN if [ "$NODE_ENV" = "development" ]; then npm install; else npm ci --omit=dev; fi

# copy compiled code
COPY --from=builder /app/dist ./dist

# copy assets
COPY ./templates ./dist/templates
COPY ./templates ./templates
COPY ./views ./views
COPY ./public ./public
COPY ./src/config/database.sql ./dist/config/database.sql

EXPOSE 3000

CMD ["node", "dist/index.js"]