# ──────────────────────────────────────────────────────────────────────────────
# Stage 1 — Dependencies
# Install only production dependencies to keep the final image small.
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files first (Docker layer caching — only re-installs if changed)
COPY package.json package-lock.json* ./

RUN npm ci --omit=dev

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2 — Final image
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Create logs directory and set ownership
RUN mkdir -p logs && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

EXPOSE 3000

# Healthcheck — Docker will mark the container unhealthy if this fails
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
