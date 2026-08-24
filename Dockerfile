# ============================================================
# AppForge Dockerfile - Production-ready multi-stage build
# ============================================================

# Stage 1: Install dependencies (requires lockfile)
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ linux-headers
COPY package.json package-lock.json ./
RUN npm install --omit=dev && npm cache clean --force

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ linux-headers
COPY package.json package-lock.json ./
RUN npm install && npm cache clean --force
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_STRIPE_PUBLIC_KEY
RUN npm run build && ls -la /app/dist/server.js && ls -la /app/dist/ | head -20

# Stage 3: Production runtime (Node + Express API server)
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
WORKDIR /app

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy runtime dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder /app/node_modules/postgres ./node_modules/postgres
COPY --from=builder /app/node_modules/pg ./node_modules/pg
COPY --from=builder /app/node_modules/@trpc ./node_modules/@trpc
COPY --from=builder /app/node_modules/express ./node_modules/express
COPY --from=builder /app/node_modules/cookie-parser ./node_modules/cookie-parser
COPY --from=builder /app/node_modules/cors ./node_modules/cors
COPY --from=builder /app/node_modules/helmet ./node_modules/helmet
COPY --from=builder /app/node_modules/compression ./node_modules/compression
COPY --from=builder /app/node_modules/express-rate-limit ./node_modules/express-rate-limit
COPY --from=builder /app/node_modules/express-slow-down ./node_modules/express-slow-down
COPY --from=builder /app/node_modules/@sentry ./node_modules/@sentry
COPY --from=builder /app/node_modules/stripe ./node_modules/stripe
COPY --from=builder /app/node_modules/zod ./node_modules/zod
COPY --from=builder /app/node_modules/superjson ./node_modules/superjson
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv

# Copy compiled server code and package metadata
COPY --from=builder /app/dist/server.js ./dist/server.js
COPY --from=builder /app/dist/db ./dist/db
COPY --from=builder /app/dist/routers ./dist/routers
COPY --from=builder /app/dist/routes ./dist/routes
COPY --from=builder /app/dist/webhooks ./dist/webhooks
COPY --from=builder /app/dist/middleware ./dist/middleware
COPY --from=builder /app/dist/utils ./dist/utils
COPY --from=builder /app/dist/_core ./dist/_core
COPY --from=builder /app/dist/db.js ./dist/db.js
COPY --from=builder /app/dist/agents ./dist/agents
COPY --from=builder /app/dist/services ./dist/services
COPY --from=builder /app/dist/validators ./dist/validators
COPY --from=builder /app/dist/config ./dist/config
COPY --from=builder /app/dist/hooks ./dist/hooks
COPY --from=builder /app/dist/lib ./dist/lib
COPY --from=builder /app/dist/types ./dist/types
COPY --from=builder /app/dist/data ./dist/data
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.env.schema.json ./.env.schema.json
COPY --from=builder /app/supabase/migrations ./supabase/migrations

# Create non-root user
RUN addgroup -g 1001 -S appforge && \
    adduser -S appforge -u 1001 -G appforge && \
    chown -R appforge:appforge /app
USER appforge

EXPOSE 3000

# Health check hits the API server
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))" || exit 1

# Use dumb-init for proper signal handling (graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]

# ============================================================
# Development stage
# ============================================================
FROM node:20-alpine AS development
RUN apk add --no-cache git python3 make g++ linux-headers
ENV NODE_ENV=development
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install && npm cache clean --force
COPY . .
EXPOSE 3000 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
