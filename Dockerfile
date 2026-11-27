# Pinned base image; bump deliberately (check the Node 22 release notes).
FROM node:22.23.5-alpine AS base
# Prisma's engines need OpenSSL at build time too (otherwise it guesses the wrong engine and warns).
RUN apk add --no-cache openssl

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Only the Prisma CLI is needed at runtime (scripts/start.sh runs `prisma migrate deploy`);
# the app itself runs from the standalone output. Keep in step with package.json.
RUN npm install --no-save --no-package-lock prisma@5.22.0 && npm cache clean --force

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY scripts/start.sh ./start.sh
COPY scripts/hash-password.mjs ./scripts/hash-password.mjs
RUN chmod +x ./start.sh && mkdir -p /app/data/receipts && chmod 700 /app/data/receipts && chown -R node:node /app

# Expense receipts are files here — mount a volume on it so they survive a new container.
ENV RECEIPTS_DIR=/app/data/receipts
VOLUME ["/app/data/receipts"]

USER node
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["./start.sh"]
