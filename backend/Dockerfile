# Dockerfile do backend (Locamania). Contexto de build = RAIZ do monorepo:
#   docker build -f backend/Dockerfile -t locamania-api .
# Base Debian slim: o Prisma em Alpine quebra por OpenSSL/musl.

# ---------- base ----------
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
# OpenSSL é exigido pelos engines do Prisma; fontes para o PDF com acento.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- build (instala o workspace, compila shared + backend) ----------
FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages packages
COPY backend backend
RUN pnpm install --frozen-lockfile --filter @locamania/backend... --filter @locamania/shared
RUN pnpm --filter @locamania/shared build \
  && pnpm --filter @locamania/backend exec prisma generate \
  && pnpm --filter @locamania/backend build

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/backend
EXPOSE 3201
# Migrations (prisma migrate deploy) rodam antes do deploy, não no start:
# com duas instâncias, as duas migrariam em paralelo.
CMD ["node", "dist/main.js"]
