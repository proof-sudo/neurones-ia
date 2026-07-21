# syntax=docker/dockerfile:1

# ─── Stage 1 : deps ──────────────────────────────────────────────────────────
# Installe les dépendances à partir du lockfile uniquement : cette couche n'est
# ré-exécutée que lorsque package.json / package-lock.json changent.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ─── Stage 2 : builder ───────────────────────────────────────────────────────
# Compile l'app. NEXT_PUBLIC_API_URL doit être présent AU BUILD : les variables
# NEXT_PUBLIC_* sont inlinées dans le bundle client par `next build`.
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 3 : runner ────────────────────────────────────────────────────────
# Image finale minimale : sort de `output: "standalone"` (server.js + node_modules
# tracés). On ajoute manuellement public/ et .next/static que server.js sert
# automatiquement s'ils sont présents.
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Utilisateur non-root
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
