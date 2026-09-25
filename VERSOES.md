# VERSOES.md — versões da stack

Mesma stack do SafeKeep (decisão do Pedro, 24/09/2026). Instaladas em set/2026:

| Item | Versão | Observação |
|---|---|---|
| Node.js | 24.16 (nvm, WSL) | `engines.node >= 24` |
| pnpm | 11.7 | `packageManager` fixado; `allowBuilds` no `pnpm-workspace.yaml` |
| Turborepo | 2.11 | |
| TypeScript | 5.9 (`~5.9.3` em todos os workspaces) | alinhado de propósito (no SafeKeep o front foi para a 6) |
| NestJS | 11.1 | |
| Prisma | **6.19** (`~6.19.3`) | o 7 muda a conexão (driver adapters); a auditoria é provada no 6. Migração é passo dedicado |
| PostgreSQL | 17 (`postgres:17-bookworm` no compose) | Supabase em produção |
| nestjs-cls | 6.2 | |
| class-validator / class-transformer | 0.15 / 0.5 | |
| argon2 | 0.44 | hash de senha (argon2id) |
| pdfkit / exceljs / qrcode | 0.20 / 4.4 / 1.5 | PDF, Excel, QR do PIX |
| nodemailer / handlebars | 9 / 4.7 | |
| Jest / ts-jest | 30 / 29 | |
| Next.js | 16.2 | App Router, usado como SPA atrás de login |
| React | 19.2 | |
| Tailwind CSS | 4.3 | CSS-first |
| TanStack Query | 5.101 | |
| lucide-react | 1.21 | |

Imagem do backend: `node:24-bookworm-slim` + `openssl` (Prisma em Alpine quebra).
