# =============================================================
# SHOWDOWN // AI Quiz Engine - Production Multi-Stage Dockerfile
# =============================================================

# -------------------------------------------------------------
# Stage 1: Build the React Client (Vite + Tailwind v4)
# -------------------------------------------------------------
FROM node:20-alpine AS client-builder
WORKDIR /app/client

# Install client dependencies
COPY client/package*.json ./
RUN npm ci

# Copy client source and compile production static bundle
COPY client/ ./
RUN npm run build

# -------------------------------------------------------------
# Stage 2: Production Runtime (Express + Socket.IO + Static UI)
# -------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001

# Install production dependencies for the root/server only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend server source
COPY server/ ./server/

# Copy compiled frontend from Stage 1 into client/dist
COPY --from=client-builder /app/client/dist ./client/dist

# Expose the server port (overridden dynamically in cloud runtimes like Render/Railway)
EXPOSE 5001

# Healthcheck to verify Express server status
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# Launch the unified server
CMD ["node", "server/src/server.js"]
