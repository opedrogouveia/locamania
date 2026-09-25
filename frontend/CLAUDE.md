# CLAUDE.md — frontend (Next.js)

Leia antes o [`CLAUDE.md`](../CLAUDE.md) da raiz e o [`docs/DESIGN_SYSTEM.md`](../docs/DESIGN_SYSTEM.md).

## O que é

Um app Next.js 16 (App Router) com **duas áreas**, usado como SPA atrás de login:

| Área | Rota | Casca | Quem |
|---|---|---|---|
| Painel administrativo | `/admin/**` | `components/layout/admin-shell.tsx` | equipe (proprietária, admin, financeiro, funcionário) |
| App do cliente | `/app/**` | `components/layout/customer-shell.tsx` | locatário |
| Públicas | `/login`, `/forgot-password`, `/reset-password`, `/first-access`, `/privacy`, `/offline` | `components/auth/auth-layout.tsx` | todos |

A casca faz a guarda (`useAreaGuard`): sem sessão → `/login?next=…`; sessão do tipo errado → a área certa.

## Organização

```
src/
  app/                    rotas (páginas 'use client')
  components/ui/          primitivos do design system (Button, Card, DataTable, Dialog, Lookup…)
  components/layout/      cascas, navegação, marca, busca (Ctrl+K), sino de notificações
  components/<domínio>/   formulários e seções reutilizáveis (customers/, contracts/, …)
  lib/api/client.ts       apiFetch/api — ÚNICO ponto de fetch (offline, 401, erros pt-BR)
  lib/api/<recurso>.ts    funções HTTP por recurso (tipadas com @locamania/shared)
  lib/<recurso>/          hooks TanStack Query (queries.ts) e metadados de tela (meta.ts: rótulos→variantes)
  lib/auth/               sessão, useMe/useStaff/useCustomerActor/useCan, login/logout, guarda
  lib/utils.ts            cn() + formatação (re-exportada do shared: formatBRL, formatYmd, formatPlate…)
```

## Regras

- **Componente nunca chama `fetch`.** Tela → hook (`lib/<recurso>/queries.ts`) → `lib/api/<recurso>.ts` → `api`.
- **Tipos só de `@locamania/shared`.** Rótulo de enum vem de `labels.ts` do shared; a cor (variante do
  Badge) vem de `lib/<recurso>/meta.ts`.
- **Query string com `qs()`** do client (genérico) — nunca montar à mão.
- **Permissão na tela**: `useCan(Permission.X)` esconde botão/menu/aba; a API decide de verdade. Valor
  que chega `null` significa "sem permissão" → mostrar "—" ou esconder a coluna.
- **Mutação invalida** as chaves afetadas (lista + detalhe + dashboard quando mexe em números).
- **Toda tela tem** loading (`Skeleton`), vazio (`EmptyState`) e erro (mensagem da API).
- **Confirmação destrutiva** com `useConfirm()`; feedback com `toast`. Nunca `alert`/`window.confirm`.
- **Sem cor hardcoded** — só tokens semânticos (`bg-primary`, `text-muted-foreground`, `border-border`…).
- **Datas**: `formatYmd()` para `YYYY-MM-DD`, `formatDateTime()` para instantes. **Dinheiro**: `formatBRL()`.
- **Responsivo sempre** (ver DESIGN_SYSTEM §5): conferir em **390 px** e **1440 px** antes de dar por pronto.
- `useSearchParams()` **não** — ler `window.location` num efeito (o hook quebra o build estático).
- Servir com `next dev`; não rodar `next build` com o dev de pé (os dois usam `.next`).

## Comandos

```bash
pnpm --filter @locamania/frontend dev        # :3200
pnpm --filter @locamania/frontend typecheck
pnpm --filter @locamania/frontend lint
pnpm --filter @locamania/frontend build
```

## Definition of Done (tela)

- Consome a API pela camada `lib/`, com tipos do shared.
- Loading, vazio e erro tratados; confirmação e toast nas ações.
- Permissões refletidas (botões/menus/abas somem sem a permissão).
- Sem rolagem horizontal em 390 px; alvos de toque ≥ 44 px; formulário usável com o teclado do celular.
