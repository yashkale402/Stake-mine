FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Disable Next.js telemetry — prevents outbound network call during build
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_API_URL  → baked into the client-side bundle (browser calls)
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# INTERNAL_API_URL → used by next.config.js rewrites (server-side proxy inside Docker)
ARG INTERNAL_API_URL=http://backend:3001
ENV INTERNAL_API_URL=$INTERNAL_API_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Carry the internal URL into the runtime image so next.config.js rewrites work
ARG INTERNAL_API_URL=http://backend:3001
ENV INTERNAL_API_URL=$INTERNAL_API_URL
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN mkdir -p ./public
EXPOSE 3000
CMD ["node", "server.js"]
