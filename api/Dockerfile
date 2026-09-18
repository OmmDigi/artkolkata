# ------------------------
# Stage 1: Build
# ------------------------
# @react-pdf/renderer ships ESM only. This is a commonjs build, so it reaches it
# through require(esm), which node only supports from 22.12 — on 18 the api
# starts and then dies the first time a document is generated.
FROM node:22-alpine AS builder

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
FROM node:22-alpine

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