FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts \
  && npx prisma generate

FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Never bake secrets into the image
RUN rm -f .env .env.* || true
ENV NUXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG BUILD_DATE
RUN export NUXT_PUBLIC_BUILD_DATE="${BUILD_DATE:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}" \
  && npx prisma generate && npm run build \
  && npm prune --omit=dev \
  && npm cache clean --force

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1
ENV HOST=0.0.0.0
ENV PORT=1337
# Drop unnecessary packages; keep openssl for Prisma
RUN apk add --no-cache openssl \
  && adduser -u 1200 -H -S -g "Konga" -D -s /sbin/nologin konga \
  && mkdir -p /app \
  && chown konga:nogroup /app

COPY --from=build --chown=konga:nogroup /app/.output ./.output
COPY --from=build --chown=konga:nogroup /app/node_modules ./node_modules
COPY --from=build --chown=konga:nogroup /app/package.json ./package.json
COPY --from=build --chown=konga:nogroup /app/prisma ./prisma
COPY --chmod=755 --chown=konga:nogroup docker-entrypoint.sh /app/docker-entrypoint.sh

# Nitro resolves asset paths from chunks/nitro as ../public → chunks/public.
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh \
  && ln -sfn ../../public /app/.output/server/chunks/public \
  && chown -h konga:nogroup /app/.output/server/chunks/public

USER konga
EXPOSE 1337
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:1337/api/settings/public').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
