# Multi-stage build for production optimization
FROM node:25-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# ===========================================
# Dependencies stage
# ===========================================
FROM base AS dependencies

# Install all dependencies (including dev)
RUN npm ci --only=production && npm cache clean --force

# ===========================================
# Build stage
# ===========================================
FROM base AS build

# Install all dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# ===========================================
# Production stage
# ===========================================
FROM base AS production

# Build arguments
ARG NODE_VERSION=18
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Labels for metadata
LABEL maintainer="David <david@example.com>" \
      org.opencontainers.image.title="UniFi Protect Notifications" \
      org.opencontainers.image.description="Sistema de notificaciones en tiempo real para UniFi Protect" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.vendor="UniFi Protect Notifications" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.url="https://github.com/davidc/unifi-protect-notifications" \
      org.opencontainers.image.source="https://github.com/davidc/unifi-protect-notifications"

# Install production dependencies
COPY --from=dependencies /app/node_modules ./node_modules

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

# Create logs directory
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]
