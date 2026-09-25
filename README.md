# Locamania — sistema de locação de motos

Painel administrativo (proprietária e equipe) + app do cliente (locatário), sobre a mesma API e o
mesmo banco. Web 100% responsiva, instalável no celular (PWA).

| Camada | Tecnologia |
|---|---|
| Monorepo | pnpm 11 + Turborepo |
| Backend | NestJS 11 (Clean Architecture) + Prisma 6 + PostgreSQL 17 |
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind 4 + TanStack Query |
| Contratos | `packages/shared` — tipos, enums, permissões, rótulos pt-BR e regras puras |
| Deploy | API no Render (Docker) · web na Vercel · banco no Supabase |

> **Idioma:** tela em pt-BR (R$, `dd/mm/aaaa`, fuso de São Paulo). Código e dados em inglês.
> Comentários e documentação em português.

## Como rodar

Pré-requisitos: Node 24+, pnpm 11 (via corepack), Docker Desktop (com WSL Integration no Windows).

```bash
pnpm install
cp .env.example .env
docker compose up -d                                  # Postgres (5433) + Mailpit (8026)
pnpm --filter @locamania/shared build
pnpm --filter @locamania/backend prisma:deploy        # migrations
pnpm --filter @locamania/backend db:seed:demo         # 12 meses de dados de demonstração
pnpm dev                                              # API :3201 + web :3200
```

| Serviço | Endereço |
|---|---|
| Sistema | http://localhost:3200 |
| API / Swagger | http://localhost:3201 · http://localhost:3201/docs |
| E-mails de dev (Mailpit) | http://localhost:8026 |

### Contas de demonstração (senha `changeme123`)

| Perfil | Login |
|---|---|
| Proprietária | `proprietaria@locamania.local` |
| Administrador | `admin@locamania.local` |
| Financeiro | `financeiro@locamania.local` |
| Funcionário | `funcionario@locamania.local` |
| Cliente (app) | CPF `529.982.247-25` |

## Comandos

```bash
pnpm dev          # tudo em watch
pnpm typecheck    # TypeScript nos três workspaces
pnpm test         # regras (shared) + backend
pnpm lint
pnpm build
```

## Onde ler mais

| Documento | Para quê |
|---|---|
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | **Comece aqui**: estado real, como rodar, pendências |
| [`docs/PLANO_MVP.md`](docs/PLANO_MVP.md) | Escopo, decisões, etapas com checkbox |
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) | Padrão de código |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | UI, responsividade |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Colocar no ar, campo a campo |
| [`docs/MANUAL_ADMIN.md`](docs/MANUAL_ADMIN.md) | Manual da administradora |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Operação, backup, incidentes |
| [`docs/REQUISITOS_CLIENTE.txt`](docs/REQUISITOS_CLIENTE.txt) | O que a cliente pediu |
| [`CLAUDE.md`](CLAUDE.md) | Regras para agentes de IA (há um por app) |
