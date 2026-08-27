# ============================================================
# AppForge Dockerfile - production is the final (default) stage
# ============================================================

FROM node:22-alpine AS deps
WORKDIR /app
ENV HUSKY=0
RUN apk add --no-cache python3 make g++ linux-headers
COPY package.json package-lock.json ./
RUN npm install --omit=dev && npm cache clean --force

FROM node:22-alpine AS builder
WORKDIR /app
ENV HUSKY=0
RUN apk add --no-cache python3 make g++ linux-headers
COPY package.json package-lock.json ./
RUN npm install && npm cache clean --force
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_STRIPE_PUBLIC_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_STRIPE_PUBLIC_KEY=$VITE_STRIPE_PUBLIC_KEY
RUN npm run build \
  && test -f /app/dist/server.js \
  && test -f /app/dist/client/index.html

FROM node:22-alpine AS production
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV HUSKY=0
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.env.schema.json ./.env.schema.json
COPY --from=builder /app/supabase/migrations ./supabase/migrations

RUN addgroup -g 1001 -S appforge && \
    adduser -S appforge -u 1001 -G appforge && \
    chown -R appforge:appforge /app
USER appforge

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health/live', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
