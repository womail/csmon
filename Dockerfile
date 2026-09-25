# syntax=docker/dockerfile:1

FROM docker.io/library/ubuntu:24.04 AS ubuntu-node
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_VERSION=22.20.0
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
  && arch="$(dpkg --print-architecture)" \
  && case "$arch" in \
       amd64) node_arch=x64 ;; \
       arm64) node_arch=arm64 ;; \
       *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
     esac \
  && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" \
     | tar -xJ -C /usr/local --strip-components=1 \
  && node -v && npm -v \
  && rm -rf /var/lib/apt/lists/*

FROM ubuntu-node AS base
ENV NEXT_TELEMETRY_DISABLED=1
# Corepack’s shims point at ~/.cache paths that often break across Docker layers/stages.
RUN npm install -g pnpm@12.5.1 && pnpm --version
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm generate-sbom && pnpm build

FROM ubuntu-node AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV CSMON_DATA_DIR=/app/data
WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /app/data \
  && chown nextjs:nodejs /app/data

COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/sbom ./sbom
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && apt-get update \
  && apt-get install -y --no-install-recommends util-linux \
  && rm -rf /var/lib/apt/lists/*

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
