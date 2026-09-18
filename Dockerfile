# ============================================================
# AppForge Dockerfile - production is the final (default) stage
# ============================================================

FROM node:22-alpine AS deps
WORKDIR /app
ENV HUSKY=0
RUN apk add --no-cache python3 make g++ linux-headers
COPY package.json package-lock.json ./
# Production dependencies do not need AppForge's prepare hook. At this stage
# the scripts/ source tree has intentionally not been copied yet, so lifecycle
# scripts must be disabled rather than running prepare against missing files.
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22-alpine AS builder
WORKDIR /app
ENV HUSKY=0
RUN apk add --no-cache python3 make g++ linux-headers
COPY package.json package-lock.json ./
# npm install of optional rollup native binary can hit npm "edgesOut" null
# on node:22-alpine; pack+extract avoids mutating the lockfile graph.
RUN npm ci --ignore-scripts \
  && ROLLUP_VERSION="$(node -p "require('./node_modules/rollup/package.json').version")" \
  && mkdir -p /tmp/rollup-native /app/node_modules/@rollup/rollup-linux-x64-musl \
  && cd /tmp/rollup-native \
  && npm pack "@rollup/rollup-linux-x64-musl@${ROLLUP_VERSION}" \
  && tar -xzf rollup-rollup-linux-x64-musl-*.tgz \
  && cp -R package/. /app/node_modules/@rollup/rollup-linux-x64-musl/ \
  && cd /app \
  && npm cache clean --force \
  && rm -rf /tmp/rollup-native
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
RUN apk add --no-cache dumb-init curl bash chromium \
  && curl -L https://fly.io/install.sh | sh \
  && mv /root/.fly/bin/flyctl /usr/local/bin/flyctl \
  && flyctl version \
  && chromium-browser --version
ENV NODE_ENV=production
ENV HUSKY=0
ENV APPFORGE_CHROMIUM_PATH=/usr/bin/chromium-browser
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