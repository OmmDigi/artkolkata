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

# Copy Needed Folders
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start"]