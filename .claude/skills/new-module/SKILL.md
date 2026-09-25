---
name: new-module
description: Cria um módulo novo da Locamania (shared → backend → frontend) seguindo o padrão em vigor. Use quando for adicionar uma entidade/área nova ao sistema.
---

# Novo módulo — Locamania

1. Leia `docs/templates/new-module.md` e o módulo de referência `backend/src/modules/customers/`.
2. Confira o termo em `docs/GLOSSARIO.md` (se não existir, acrescente antes de criar o schema).
3. Siga a ordem: contrato/enum/regra no `packages/shared` (com teste) → model no `schema.prisma` +
   migration → porta → repositório Prisma → serviço de aplicação → mapper → DTO HTTP (mensagens
   pt-BR) → controller com `@RequirePermissions` → módulo → `src/modules/index.ts` → frontend
   (`lib/api`, `lib/<recurso>/queries.ts`, telas) → menu com permissão.
4. Verifique rodando: HTTP (curl com token) e tela em 390 px e 1440 px.
5. `pnpm typecheck && pnpm test`, marque o checkbox em `docs/PLANO_MVP.md`, commit em pt-BR dizendo o porquê.
