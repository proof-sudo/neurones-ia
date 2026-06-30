# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://ia.neuronestech.com/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
COPY postinstall.cjs ./
# Cache npm partagé entre builds (BuildKit) → rebuilds plus rapides.
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build

# ─── Image de production ─────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 nodejs && adduser -S -u 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
