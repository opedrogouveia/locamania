# CLAUDE.md — backend (NestJS)

Leia antes o [`CLAUDE.md`](../CLAUDE.md) da raiz e o [`docs/ARQUITETURA.md`](../docs/ARQUITETURA.md).

## Camadas (a dependência aponta para dentro)

```
src/modules/<contexto>/
  domain/           regras puras, tipos de registro, PORTAS (interfaces) + tokens Symbol — sem Nest, sem Prisma
  application/      serviço de aplicação (casos de uso) — depende só das portas; lança DomainError
  infrastructure/   implementação Prisma das portas (repositórios, consultas), gateways externos
  presentation/     controller fino + http/*.dto.ts (class-validator + Swagger, `implements` o contrato do shared)
  <contexto>.module.ts   único lugar que liga porta → implementação
src/shared/         auth, cls, config, errors, http (paginação, mappers, validadores), mail, pdf, prisma, parameters, time
```

- **Prisma só na `infrastructure`.** Application e presentation nunca importam `@prisma/client`.
- **Regra de negócio** vai para `packages/shared/src/rules/` (se o frontend também usa) ou para
  `domain/` do módulo — sempre como **função pura com teste**. O serviço de aplicação orquestra.
- **Erros**: domínio/aplicação lançam `ValidationError | NotFoundError | ConflictError | ForbiddenError |
  UnauthorizedError` com mensagem em **pt-BR** pronta para a tela. Nunca `HttpException` fora da presentation.
- **Retorno do serviço** já é o DTO do contrato (`@locamania/shared`) — o mapeamento registro → DTO fica
  num `*.mapper.ts` da application, que decide o que ocultar pelo `Principal`.

## Convenções

- Toda rota da equipe: `@RequirePermissions(Permission.X)`. Rota do cliente: `@CustomerRoute()` e
  `@CurrentCustomer()` — **nunca** aceitar `customerId` da URL/corpo no portal.
- Dinheiro: `money()` / `toDecimalInput()` de `shared/http/mappers.ts`. Datas só-dia: `ymd()` / `dbDate()`.
- "Hoje": `ClockService.today()`. Nunca `new Date()` em cálculo de vencimento.
- Parâmetros de regra: `ParametersService` (tolerância, multa, avisos…). Nada hardcoded.
- Listagem: estender `PaginationQueryDto`, usar `pageParams()` e `paginated()`.
- Transação que envolve várias tabelas (ex.: entregar a moto) fica num método do repositório que usa
  `prisma.client.$transaction` — a decisão é da application, a atomicidade é da infrastructure.
- Escrita de negócio sempre por `prisma.client` (auditada). `prisma.raw` só para leitura pesada,
  notificações, jobs técnicos e registros que não interessam ao histórico.
- Notificação: `NotificationsService.notify(...)` com `dedupeKey` — nunca criar `Notification` direto.

## Comandos

```bash
pnpm --filter @locamania/backend dev            # API em watch (:3201)
pnpm --filter @locamania/backend test           # Jest
pnpm --filter @locamania/backend typecheck
pnpm --filter @locamania/backend prisma:migrate # nova migration após mudar o schema (dev)
pnpm --filter @locamania/backend db:seed        # referência + proprietária (idempotente)
pnpm --filter @locamania/backend db:seed:demo   # APAGA o negócio e recria 12 meses de demonstração
docker build -f backend/Dockerfile -t locamania-api .
```

Migration em ambiente não interativo: ver [`docs/ARQUITETURA.md`](../docs/ARQUITETURA.md) §8.
**Rename de coluna/tabela nunca pelo diff** (vira DROP + ADD): SQL manual com `ALTER ... RENAME`.

## Definition of Done

- Regra em função pura com teste; serviço de aplicação dependendo de portas.
- Rotas com permissão declarada, DTO validado (mensagens pt-BR), documentadas no Swagger.
- Valores ocultos conforme permissão; portal sem vazamento (teste de isolamento).
- Auditoria cobrindo as escritas (automática) + evento semântico quando houver.
- Contrato no `packages/shared`; migration versionada; `pnpm typecheck` e `pnpm test` verdes.

## O que NÃO fazer

- Regra de negócio em controller. Prisma fora da infrastructure. Hard delete.
- Rota sem `@RequirePermissions` / `@CustomerRoute`. `customerId` vindo do cliente.
- `new Date()` para "hoje". Float para dinheiro. Texto livre onde cabe catálogo.
- Chamar gateway/WhatsApp/rastreador direto — sempre pela porta.
