# FROM node:18-alpine AS builder
# WORKDIR /app
# COPY package*.json ./
# RUN npm install
# COPY . .
# RUN npm run build

# FROM node:18-alpine
# WORKDIR /app
# COPY --from=builder /app/.next ./.next
# COPY --from=builder /app/public ./public
# COPY --from=builder /app/package.json ./package.json
# RUN npm install --production
# CMD ["npm", "run", "dev"]

# FROM node:18-alpine

# # Set working directory inside container
# WORKDIR /app

# # Copy only package.json and package-lock.json (for caching)
# COPY package*.json ./

# # Install dependencies
# RUN npm ci --only=production

# # Copy rest of the project
# COPY . .

# # Expose app port
# EXPOSE 3000

# # Build your project
# RUN npm run build

# # Start the app
# CMD ["npm", "run", "start"]


# ------------------------
# Stage 1: Build Stage
# ------------------------
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Install bash and other build tools
RUN apk add --no-cache bash

# Copy package.json and package-lock.json
COPY package*.json ./

ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Install all dependencies (including dev)
RUN npm ci --force

# Copy the rest of the source code
COPY . .

# Build TypeScript
RUN npm run build

# ------------------------
# Stage 2: Production Stage
# ------------------------
FROM node:24-alpine

WORKDIR /app

# Copy only package.json & package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --force --only=production

# Copy the built JS files from builder
COPY --from=builder /app/.next ./.next

# If you have static files, copy them too
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start"]