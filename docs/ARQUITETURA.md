# Arquitetura e padrões de código — Locamania

> O padrão **em vigor**, com exemplos do código. É a referência para qualquer pessoa (ou IA)
> escrever código novo igual ao que já existe. Herdado do SafeKeep, com as inconsistências que ele
> acumulou já resolvidas (ver [`HERANCA_SAFEKEEP.md`](HERANCA_SAFEKEEP.md) §10.1). Escrito em 24/09/2026.

---

## 1. Visão geral

```
Tela (client component)                 frontend/src/app/admin/customers/page.tsx
  └─ hook TanStack Query                frontend/src/lib/customers/queries.ts
      └─ função HTTP                    frontend/src/lib/api/customers.ts
          └─ api/apiFetch               frontend/src/lib/api/client.ts   ← JWT, offline, 401, erros
              │  GET /customers?status=OVERDUE
              ▼
Guards globais                          JwtAuthGuard → ActorGuard (equipe/cliente + permissões) → RateLimitGuard
  └─ Controller fino + DTO validado     backend/src/modules/customers/presentation/
      └─ Serviço de aplicação           backend/src/modules/customers/application/customers.service.ts
          ├─ Regras puras               packages/shared/src/rules/ · modules/*/domain/
          └─ Porta (interface)          modules/customers/domain/customers.ports.ts
              └─ Implementação Prisma   modules/customers/infrastructure/prisma-customers.repository.ts
                  └─ client estendido → AuditLog gravado automaticamente
      └─ Mapper → DTO do contrato       modules/customers/application/customers.mapper.ts (oculta valores pelo Principal)
```

Três ideias sustentam tudo: **a dependência aponta para dentro**, **o Prisma não sobe além da
infrastructure** e **o contrato do `packages/shared` é a única definição de tipo** entre as pontas.

---

## 2. Backend — camadas por módulo

| Camada | Contém | Pode importar | Não pode |
|---|---|---|---|
| `domain/` | regras puras do módulo, **tipos de registro** (interfaces), **portas** + tokens `Symbol` | `@locamania/shared`, `shared/errors` | NestJS, Prisma, HTTP |
| `application/` | **serviço de aplicação** (casos de uso como métodos), mapper registro → DTO | `domain`, `@nestjs/common` (DI), serviços transversais | Prisma, Express |
| `infrastructure/` | implementação das portas com Prisma, gateways externos (PIX, WhatsApp, rastreador) | `domain`, Prisma | HTTP |
| `presentation/` | controller + `http/*.dto.ts` | `application`, Nest, Swagger | Prisma, regra de negócio |

### Decisões que fecham as dívidas do SafeKeep

- **Sem classe de entidade com getters.** No SafeKeep elas eram "quase anêmicas" (props + getters +
  regra estática). Aqui o domínio é **tipo de registro + regra pura + porta**: o registro é uma
  interface TypeScript simples, e a regra é função pura com teste. Menos cerimônia, mesma separação.
- **Casos de uso agrupados num serviço de aplicação por módulo** (`CustomersService.create/update/…`),
  e não uma classe por caso de uso. Caso de uso com lógica grande ganha arquivo próprio em `application/`.
- **O repositório recebe dados planos e devolve registros** (`create(data: CreateCustomerData)`), o
  mesmo padrão real do SafeKeep — e agora o template diz a mesma coisa que o código.
- **O serviço devolve o DTO do contrato** (via mapper da application), e o controller só repassa. O
  mapper recebe o `Principal` e decide o que vira `null` (dinheiro sem permissão).
- **Operação que toca várias tabelas** (ex.: entregar a moto = ativar contrato + mudar moto + gerar
  cobranças + atualizar cliente) é **um método do repositório com `$transaction`**. A decisão e o
  cálculo são da application; a atomicidade, da infrastructure.

### Anatomia de um módulo — referência: `modules/customers/`

```
customers/
  domain/
    customers.ports.ts         CUSTOMERS_REPOSITORY = Symbol(...) + interface + CreateCustomerData
    customer-rules.ts          (se houver regra só deste módulo)
  application/
    customers.service.ts       casos de uso; lança ValidationError/NotFoundError…
    customers.mapper.ts        registro → CustomerDto (oculta valores conforme o Principal)
  infrastructure/
    prisma-customers.repository.ts
  presentation/
    customers.controller.ts    @ApiTags, @ApiBearerAuth, @RequirePermissions em TODA rota
    http/customers.dto.ts      class-validator (mensagens pt-BR) + @ApiProperty, `implements` o contrato
  customers.module.ts          { provide: CUSTOMERS_REPOSITORY, useClass: PrismaCustomersRepository }
```

---

## 3. Transversais (`backend/src/shared/`)

| Peça | Faz |
|---|---|
| `auth/` | `JwtStrategy` + `SessionResolverService` (confere conta ativa e versão da sessão, cache 15 s), `PermissionsService` (matriz no banco, OWNER sempre tudo), guards `JwtAuthGuard` / `ActorGuard` / `RateLimitGuard`, decorators `@Public` `@CustomerRoute` `@RequirePermissions` `@RateLimit` `@CurrentStaff` `@CurrentCustomer`, `moneyFor()` |
| `prisma/` | `PrismaService.client` (auditoria automática) e `.raw`; extensão que audita toda escrita, com autor "Sistema" fora de requisição |
| `errors/` | `DomainError` (`VALIDATION`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN`, `UNAUTHORIZED`) + filtro global com envelope `ApiErrorResponse` (mensagem pt-BR + `code`) |
| `http/` | `PaginationQueryDto`, `pageParams()`, `paginated()`, mappers (`ymd`, `dbDate`, `money`, `toDecimalInput`), validadores (`@IsYmd`, `@IsCpf`, `@IsPlate`, `@IsMoney`) |
| `parameters/` | `ParametersService`: regras configuráveis (tolerância, multa, juros, avisos…) com cache |
| `time/` | `ClockService.today()` — "hoje" no fuso da empresa |
| `mail/` | `MailService` com layout único; sem SMTP só registra no log; falha nunca quebra a operação |
| `pdf/` | `PdfBuilder` (cabeçalho, parágrafos, tabela, assinaturas, rodapé paginado) |
| `observability/` | Sentry opt-in (sem dados pessoais no evento) |

---

## 4. Autenticação e isolamento

- JWT próprio `{ sub, typ: 'staff' | 'customer', ver }`. Login único: e-mail → equipe, CPF → cliente.
- `ver` = versão da sessão. Trocar senha / "encerrar sessões" incrementa → tokens antigos caem.
- **Rota sem `@CustomerRoute()` recusa token de cliente.** Rotas do app do cliente vivem em
  `/portal/*` e usam `@CurrentCustomer()` — o id vem do token, nunca da URL ou do corpo.
- Teste de isolamento obrigatório no portal: cliente A não enxerga nada do cliente B.

---

## 5. Auditoria

Automática: a extensão do Prisma grava `AuditLog` em toda escrita (`CREATE`, `UPDATE`, `DELETE` para
arquivamento, `STATUS_CHANGE` quando muda `status`), com autor, IP, user-agent e `correlationId`.
Explícita (`AuditService.record`): `LOGIN`, `LOGOUT`, `EXPORT`, `COMMAND`. Fora da auditoria automática:
`Notification`, `NotificationDelivery`, `JobRun`, `TrackerPosition`, `AuthToken`, `GatewayEvent`
(volume alto, sem valor de histórico). A tela de Histórico transforma cada registro numa frase
(`modules/audit/domain/audit-describer.ts`).

---

## 6. Regras de negócio e status derivados

- Funções puras em `packages/shared/src/rules/` (cronograma, encargos, situação da cobrança,
  manutenção, situação do cliente, lembretes) — **usadas pelo backend, pelo frontend (prévia do
  cronograma) e pela seed**, com teste.
- **Status que depende do tempo é calculado na leitura** (`chargeDisplayStatus`, `maintenanceDueStatus`).
  O job diário só persiste o atraso (para filtrar no banco) e dispara os avisos.
- Parâmetros vêm do `ParametersService`, nunca de constante no código.

---

## 7. Integrações externas — sempre atrás de uma porta

| Porta | Provedor no MVP | Real depois |
|---|---|---|
| `PaymentGateway` | `SandboxPaymentGateway` — PIX de teste, confirmação por webhook assinado (HMAC) com idempotência | Asaas / Mercado Pago / Efí |
| `WhatsAppChannel` | `DisabledWhatsApp` — registra "não configurado"; a tela oferece link `wa.me` | WhatsApp Business Platform |
| `TrackerProvider` | `SandboxTracker` — posições simuladas, comandos registrados como simulados | API do fornecedor do rastreador |
| e-mail | SMTP (Mailpit em dev) | Resend |

A regra: **nunca** chamar o fornecedor direto de um serviço de negócio. Trocar de fornecedor = novo
adaptador + variável de ambiente.

---

## 8. Banco e migrations

- Schema em `backend/prisma/schema.prisma` com comentários `///` explicando o porquê de cada modelo.
- Dev: `pnpm --filter @locamania/backend prisma:migrate` (interativo).
- Ambiente não interativo (o caminho seguro): `npx prisma migrate diff --from-url "$DATABASE_URL"
  --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<ts>_<nome>/migration.sql`
  → revisar (`grep -E "DROP|DELETE"`) → `npx prisma migrate deploy`. **Sem `--from-url` o diff gera o
  banco inteiro.** Não redirecionar a saída de comando que imprime aviso para dentro do SQL.
- **Rename nunca pelo diff** (vira DROP + ADD e perde dado): `ALTER TABLE … RENAME` à mão, e
  atualizar `AuditLog.entityType` se for model.
- Antes de deploy: rodar a cadeia de migrations do zero num banco vazio.

---

## 9. Frontend

Ver [`frontend/CLAUDE.md`](../frontend/CLAUDE.md) e [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md). Resumo:
tela → hook → função HTTP → `api`; tipos do shared; `qs()` genérico; permissões com `useCan`;
responsivo conferido em 390 px e 1440 px.

---

## 10. Checklist de feature nova

**Shared:** contrato (`contracts/*.ts`), enum (+ rótulo em `labels.ts`), regra pura com teste.
**Backend:** porta no `domain` → repositório Prisma → serviço de aplicação → mapper → DTO HTTP com
validação → controller com `@RequirePermissions` → binding no módulo → `modules/index.ts` → Swagger.
**Frontend:** `lib/api/<recurso>.ts` → `lib/<recurso>/queries.ts` (+ `meta.ts`) → tela seguindo o padrão
→ loading/vazio/erro → permissões → 390 px e 1440 px.
**Sempre:** `pnpm typecheck` + `pnpm test` verdes; checkbox no `PLANO_MVP.md`; decisão nova no log.
