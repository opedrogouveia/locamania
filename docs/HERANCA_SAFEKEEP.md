# Herança do SafeKeep — o padrão que o Locamania reaproveita

> **O que é.** Tudo o que foi construído e aprendido no SafeKeep (`~/projetos/safekeep`, 81 commits,
> jun–set/2026) e que vale para um projeto novo com a mesma stack e o mesmo harness. Fontes: os docs
> do repositório (`CLAUDE.md`, `docs/ARQUITETURA.md`, `docs/HANDOFF.md`, `docs/DEPLOY.md`,
> `docs/decisoes-e-perguntas.md`…), o código da fundação, as memórias do Claude e as conversas das
> sessões.
>
> **Como usar.** Ponto de partida da Fase 0 do Locamania. Cada peça da fundação aponta para o
> arquivo do SafeKeep que serve de **molde** (caminhos relativos a `~/projetos/safekeep/`). Quando o
> Locamania tiver os próprios `CLAUDE.md`, `ARQUITETURA.md` e `HANDOFF.md`, este documento vira
> histórico.
>
> Escrito em 24/09/2026.

---

## 1. Stack (versões efetivamente instaladas)

| Camada | Escolha | Versão | Observação |
|---|---|---|---|
| Runtime | Node.js (nvm dentro do WSL) | 24.16 | `engines.node >= 24` |
| Gerenciador | pnpm via corepack | 11.7 | fixado em `packageManager` |
| Monorepo | pnpm workspaces + Turborepo | turbo 2.9 | workspaces `backend`, `frontend`, `packages/*` |
| Linguagem | TypeScript estrito | 5.9 | o frontend acabou com `^6.0.3`: **alinhar a versão desde o início** |
| Backend | NestJS | 11.1 | Clean Architecture modular |
| ORM | Prisma | **6.19** | o 7 ficou para depois (ver §10.1) |
| Banco | PostgreSQL | 17 | local em Docker; produção no Supabase |
| Validação | class-validator + class-transformer | 0.15 / 0.5 | `ValidationPipe` global |
| Contexto de request | nestjs-cls | 6.2 | AsyncLocalStorage → ator/IP na auditoria |
| Auth | @nestjs/jwt + passport-jwt + argon2id | 11 / 4 / 0.44 | JWT próprio, sem refresh |
| Docs de API | @nestjs/swagger | 11.4 | `/docs` |
| Health | @nestjs/terminus | 11.1 | `/health` com `SELECT 1` |
| Agendamento | @nestjs/schedule | 6.1 | avisos automáticos por cron |
| E-mail | nodemailer + handlebars | 9 / 4.7 | Mailpit em dev, Resend em produção |
| PDF | pdfkit | 0.20 | orçamento e fatura |
| Erros em produção | @sentry/node | 10 | liga só com `SENTRY_DSN` |
| Testes | Jest + ts-jest | 30 / 29 | `*.spec.ts` ao lado do código |
| Frontend | Next.js (App Router) | 16.2 | usado como SPA atrás de login |
| UI | React + Tailwind v4 (CSS-first) | 19.2 / 4.3 | sem `tailwind.config` |
| Estado de servidor | TanStack Query | 5.101 | |
| Componentes | primitivos próprios estilo shadcn (cva + clsx + tailwind-merge) | — | **sem Radix**; ícones `lucide-react` |
| Lint / format | ESLint 9 (flat) + typescript-eslint 8 + Prettier 3 | | config base na raiz, cada app estende |
| Deploy | Render (Docker) + Vercel + Supabase + Resend | — | tudo em camada gratuita |
| Backup | GitHub Actions + `pg_dump` | — | diário, artefato de 30 dias |

**Decisões fechadas no SafeKeep** (não reabrir sem combinar): monorepo pnpm + Turborepo; NestJS +
Prisma + PostgreSQL; JWT no próprio backend; REST + OpenAPI; Next.js + Tailwind; contratos em
`packages/shared`; **Docker só no backend** (padrão da empresa do Pedro — o frontend roda nativo e
faz deploy nativo na Vercel); sem prefixo global `/api`.

---

## 2. Estrutura do monorepo

```
<projeto>/
├── backend/                  # API NestJS (Clean Architecture) + prisma/ + Dockerfile
│   ├── CLAUDE.md             # regras do backend para o agente
│   ├── prisma/               # schema.prisma, migrations/, seed.ts
│   └── src/
│       ├── main.ts           # bootstrap
│       ├── app.module.ts     # composição + guards/interceptor/filter globais
│       ├── modules/<contexto>/{domain,application,infrastructure,presentation}/
│       └── shared/           # auth, cls, config, errors, prisma, http, mail, security...
├── frontend/                 # Next.js — sem Docker
│   ├── CLAUDE.md             # ⚠️ no SafeKeep estava como CLAUDE-FRONT.md (ver §7.4)
│   ├── vercel.json
│   └── src/{app,components,lib}/
├── packages/shared/          # contratos de API + enums — fonte da verdade dos tipos
├── docs/                     # HANDOFF (mestre), ARQUITETURA, DESIGN_SYSTEM, DEPLOY, decisões...
├── specs/                    # uma spec por feature, com critérios de aceitação
├── scripts/                  # backup-db.sh, setup-supabase.sh
├── .github/workflows/        # backup.yml
├── .claude/                  # launch.json (e, no Locamania, skills/settings — ver §7.4)
├── CLAUDE.md  README.md  VERSOES.md  PROMPT_INICIAL_CLAUDE_CODE.md
├── docker-compose.yml  render.yaml  .env.example
└── package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json  eslint.config.mjs
    .prettierrc.json  .prettierignore  .npmrc  .gitignore  .gitattributes  .dockerignore
```

### Arquivos da raiz — o que cada um carrega

| Arquivo | Conteúdo que importa |
|---|---|
| `package.json` | scripts via turbo (`build`, `dev`, `lint`, `test`, `typecheck`) + `format`/`format:check` do Prettier; `packageManager: pnpm@11.7.0`; devDeps de lint/TS/turbo |
| `pnpm-workspace.yaml` | `backend`, `frontend`, `packages/*` + **`allowBuilds`** (o pnpm 11 exige aprovar scripts de build: `prisma`, `@prisma/client`, `@prisma/engines`, `argon2`, `sharp`, `unrs-resolver`; `@scarf/scarf: false`) |
| `turbo.json` | `build`/`lint`/`typecheck`/`test` com `dependsOn: ["^build"]` (o shared compila antes); `dev` com `cache: false, persistent: true`; `globalEnv` com as variáveis que afetam build |
| `tsconfig.base.json` | ES2023, NodeNext, `strict`, `noUnusedLocals/Parameters`, `noImplicitOverride`, `noFallthroughCasesInSwitch` |
| `eslint.config.mjs` | base flat config (recommended + typescript-eslint + prettier; `no-unused-vars` com `^_`; `no-explicit-any` como aviso). **Cada app precisa de um `eslint.config.mjs` próprio que importa a base** — o flat config não procura configs em pastas acima |
| `.prettierrc.json` | `singleQuote`, `semi`, `trailingComma: all`, `printWidth: 100`, `tabWidth: 2`, `endOfLine: lf` |
| `.gitattributes` | `* text=auto eol=lf` + binários + `pnpm-lock.yaml -diff linguist-generated` (ver §10.2) |
| `.dockerignore` | exclui `node_modules`, `dist`, `.next`, `.turbo`, **`**/*.tsbuildinfo`**, `.env*`, `frontend`, `docs`, `specs` |
| `.env.example` | toda variável com um comentário explicando o **porquê** — é documentação, não só lista |
| `docker-compose.yml` | `postgres:17-bookworm` com healthcheck + `axllent/mailpit` (SMTP 1025, web 8025) + `api` opcional apontando para o host `postgres` |
| `render.yaml` | blueprint da API (Docker, free, Oregon, `healthCheckPath: /health`, `JWT_SECRET` com `generateValue`, URL pública via `fromService`) |

Moldes: todos na raiz de `~/projetos/safekeep/`. Trocar `safekeep`/`@safekeep` pelo nome novo.

---

## 3. Backend

### 3.1 Camadas — a regra de dependência aponta para dentro

| Camada | Contém | Pode importar | Não pode |
|---|---|---|---|
| `domain/` | entidade, value objects, regras puras, **interface** do repositório + token `Symbol` | tipos de `@<proj>/shared`, erros de domínio | NestJS, Prisma, HTTP |
| `application/` | use cases (`execute()`), DTOs de aplicação (tipos puros) | `domain`, `@nestjs/common` só para DI | Prisma, Express |
| `infrastructure/` | repositório Prisma, mapper (Prisma → domínio, **uma direção só**), gateways | `domain`, Prisma | HTTP |
| `presentation/` | controller fino + `http/` (request/response/query DTOs) | `application`, Nest, Swagger | Prisma, regra de negócio |

Caminho de uma requisição: tela → hook TanStack → `lib/api/<recurso>.ts` → `apiFetch` → controller
→ `ValidationPipe` + RequestDto → use case → regra do domínio → interface do repositório → impl.
Prisma → client estendido grava o `AuditLog` → `ResponseDto.fromDomain()` → JSON.

### 3.2 Anatomia de um módulo — molde: `backend/src/modules/customers/`

```
customers/
  domain/
    customer.entity.ts          # props privadas + getters + regras estáticas (resolvePartner)
    customer.repository.ts      # CUSTOMER_REPOSITORY = Symbol(...) + interface + Create/UpdateData
    value-objects/customer-code.ts
  application/
    dto/customer.dto.ts         # Create/Update/List Input (sem decorators)
    use-cases/{create,update,list,get,delete}-customer.use-case.ts (+ .spec.ts)
  infrastructure/
    customer.mapper.ts          # CUSTOMER_INCLUDE + toDomain()
    prisma-customer.repository.ts
  presentation/
    customers.controller.ts     # @ApiTags, @ApiBearerAuth, @Roles em TODA rota
    http/{create,update}-customer.request.ts   # class-validator + @ApiProperty, `implements` o contrato
    http/customer.response.ts   # @ApiProperty + static fromDomain(); datas em ISO
    http/list-customers.query.ts
  customers.module.ts           # único lugar onde { provide: TOKEN, useClass: PrismaRepo }
```

Convenções que o código real segue (e que o template antigo contradizia — §10.1):

- O repositório **recebe dados planos** (`create(data: CreateCustomerData)`) e **devolve entidade**.
  Nenhuma entidade tem `static create()`.
- Toda leitura filtra `deletedAt: null` **explicitamente**; listagem faz `findMany` + `count` num
  `$transaction`.
- Listagem: `DEFAULT_PAGE_SIZE = 20`, `MAX_PAGE_SIZE = 100`, resposta
  `{ data, total, page, pageSize, totalPages }`.
- Quando a lista precisa de outra entidade, cria-se um tipo de linha (`CaseListItem = { order, customer }`)
  em vez de pendurar a relação na entidade; `include` na query para evitar N+1.
- Regra de dinheiro, prazo e cobrança fica em **funções puras com teste** (`*-pricing.ts`,
  `*-billing.ts`, `*-rules.ts`), não no controller nem no use case.
- Módulos pequenos sem regra própria (tabelas de apoio) não precisam das quatro camadas.

### 3.3 Fundação transversal — `backend/src/shared/`

| Peça | O que faz | Molde |
|---|---|---|
| `config/env.validation.ts` | schema das variáveis com class-validator; **fail-fast no boot** | copiar |
| `config/configuration.ts` | `AppConfig` tipado, lido com `ConfigService<AppConfig, true>` | copiar |
| `cls/cls-store.ts` | `AppClsStore` + `CLS_KEYS` (actorId, actorName, ip, userAgent, correlationId) | copiar |
| `http/audit-context.interceptor.ts` | copia `req.user` para o CLS depois dos guards | copiar |
| `prisma/prisma.service.ts` | expõe `client` (estendido, com auditoria) e `raw` (base, para escrever auditoria) | copiar |
| `prisma/prisma.extension.ts` | `$allModels.$allOperations`: grava `AuditLog` em toda escrita; `update` com `deletedAt` vira `DELETE`, com `status` vira `STATUS_CHANGE`; ignora o próprio `AuditLog`; **falha de auditoria nunca quebra a operação** | copiar |
| `prisma/audit.util.ts` | `jsonSafe()` (Decimal/Date), `maskSecrets()` (passwordHash, token…), `buildChanges()` | copiar |
| `errors/domain-errors.ts` | `DomainError` com `code` (`VALIDATION`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`) | copiar |
| `errors/all-exceptions.filter.ts` | `code` → status HTTP; envelope `ApiErrorResponse` com `correlationId`; Sentry só para erro inesperado | copiar |
| `auth/guards/jwt-auth.guard.ts` + `decorators/public.decorator.ts` | JWT global; `@Public()` libera | copiar |
| `auth/guards/roles.guard.ts` + `decorators/roles.decorator.ts` | RBAC por `@Roles(...)`. **Sem `@Roles`, qualquer autenticado passa** | copiar |
| `auth/strategies/jwt.strategy.ts` | aceita Bearer **ou** cookie httpOnly | copiar |
| `auth/auth-cookie.ts` | cookie httpOnly desligado por padrão (só com front e API no mesmo domínio) | copiar |
| `auth/decorators/current-user.decorator.ts` + `authenticated-user.ts` | `@CurrentUser()` | copiar |
| `security/` | porta `PasswordHasher` + Argon2id; módulo **global** (evita ciclo Auth ↔ Users) | copiar |
| `health/` | `/health` público | copiar |
| `mail/mail.service.ts` | Handlebars + partials (`header`, `footer`, `button`) + helper `concat`; sem `MAIL_HOST` só registra no log; **falha de envio nunca quebra a transação** | adaptar |
| `observability/sentry.ts` | inicia antes do Nest; `beforeSend` remove body, cookies e authorization | copiar |
| `http/rate-limit.guard.ts` | freio por IP em memória para rota pública (5 por 10 min) | copiar (Redis quando escalar) |
| `pdf/` | pdfkit para documentos | se precisar |

Módulos transversais (em `modules/`): `audit` (`AuditService.record()` para `LOGIN`, `LOGOUT`,
`EXPORT` e eventos semânticos, gravando via `raw`), `auth` (`LoginUseCase` com mensagem genérica e
auditoria do LOGIN, `GetMe`, `Logout` stateless que só audita, porta `TokenService`), `users`
(entidade com `canAuthenticate()`/`isAdmin()`, `user-rules.ts` com senha mínima de 8, "não se
trancar para fora" e "sempre sobra um ADMIN ativo") e `activity` (linha do tempo lida do `AuditLog`,
com `includeFinancial` pelo papel).

### 3.4 `app.module.ts` e `main.ts` — molde: `backend/src/`

- `ConfigModule.forRoot({ isGlobal, validate: validateEnv, load: [configuration] })`.
- `ClsModule.forRoot({ global, middleware: { mount, setup } })`: o `setup` grava `correlationId`
  (do header `x-correlation-id` ou `randomUUID()`), `ip` e `userAgent`.
- Providers globais nesta ordem: `APP_GUARD` JwtAuthGuard → `APP_GUARD` RolesGuard →
  `APP_INTERCEPTOR` AuditContextInterceptor → `APP_FILTER` AllExceptionsFilter.
- `declare global { namespace Express { interface User extends AuthenticatedUser {} } }`.
- `main.ts`: `initSentry()` antes de tudo → `cookieParser()` → `trust proxy 1` (IP correto atrás do
  Render) → CORS com `credentials: true` → `ValidationPipe({ whitelist, forbidNonWhitelisted,
  transform, enableImplicitConversion })` → Swagger em `/docs` com bearer → `enableShutdownHooks()`.

### 3.5 Prisma — convenções do schema

- `id String @id @default(cuid())`, `createdAt`/`updatedAt` em tudo, `deletedAt DateTime?` onde
  houver exclusão, dinheiro em `Decimal(12,2)`.
- `datasource` com `url = env("DATABASE_URL")` e `directUrl = env("DIRECT_URL")`.
- Modelos de fundação: `User` (role, active, deletedAt), `AuditLog` (occurredAt, actorId,
  actorName, action, entityType, entityId, changes Json, metadata Json, correlationId; índices em
  `[entityType, entityId]`, `actorId`, `occurredAt`), `AppParameter` (chave/valor tipado editável
  pela tela), `CatalogItem` (`group` + `code` estável + `label` editável + `sortOrder` + `active`),
  `UserTablePreference` (colunas por usuário, no banco porque trocam de máquina).
- Comentários `///` no schema explicando o **porquê** de cada modelo — viram documentação.
- Seed determinística (PRNG com semente fixa), usuários vindos do `.env`, volume realista para as
  telas fazerem sentido. **A seed apaga os dados de negócio**: nunca rodar depois do go-live.

---

## 4. `packages/shared` — contratos

- `src/enums/index.ts`: enums como **`as const` + união de literais de mesmo nome** (não `enum` do
  TS), casando 1:1 com os enums do Postgres. Regras de negócio simples e compartilhadas também
  moram aqui (ex.: `SERVICE_LEVEL_RULES`).
- `src/contracts/<recurso>.ts`: `XDto`, `CreateXRequest`, `UpdateXRequest = Partial<…>`,
  `ListXQuery extends PaginationQuery`. Base: `pagination.ts` (`PaginationQuery`,
  `PaginatedResponse<T>`), `error.ts` (`ApiErrorResponse`), `auth.ts`.
- Dinheiro trafega como **string** (`"1250.00"`); datas como **ISO**; taxas percentuais como number.
- Utilitários usados nos dois lados também podem morar aqui (no SafeKeep: máscaras e gerador de
  código de barras).
- Compila para `dist/` em CommonJS (`incremental: false`). **Mudou contrato → `pnpm --filter
  @<proj>/shared build`**, porque back e front consomem o `dist`. Com `pnpm dev`, o shared fica em watch.

---

## 5. Frontend

### 5.1 Camadas — regra dura: componente nunca chama `fetch`

```
app/(app)/**/page.tsx       telas (client components) dentro do app shell
app/login, app/<públicas>   fora do shell
components/ui/*             primitivos do design system
components/<domínio>/*      componentes de domínio
components/layout/*         shell, sidebar, topbar, marca, nav-config
lib/api/client.ts           apiFetch — ÚNICO ponto de fetch
lib/api/<recurso>.ts        funções HTTP por recurso + toQueryString()
lib/<recurso>/use-*.ts      hooks TanStack Query
lib/auth/*                  sessão, useMe/useLogin/useLogout, guardas de rota
lib/utils.ts                cn(), formatação de moeda e data (um lugar só)
```

Moldes: `frontend/src/lib/api/client.ts`, `lib/api/customers.ts`, `lib/customers/use-customers.ts`,
`lib/auth/*`, `app/layout.tsx`, `app/providers.tsx`, `components/layout/*`, `components/ui/*`,
`app/globals.css`, `next.config.ts`, `eslint.config.mjs`, `vercel.json`.

- **`apiFetch`**: anexa o JWT, `credentials: 'include'`, trata 204, lança `ApiError` com o envelope
  do backend. **`downloadFile`** baixa PDF autenticado por blob (link direto não manda header, e
  token na query vaza em log).
- **Hooks**: `const KEY = 'recurso'`; `useXs(query)`, `useX(id)` com `enabled: !!id`,
  `useCreateX`/`useUpdateX`/`useDeleteX` invalidando `[KEY]`.
- **Providers**: `ThemeProvider` → `QueryClientProvider` (`refetchOnWindowFocus: false`,
  `staleTime: 30_000`) → `ConfirmProvider` + `Toaster`.
- **Layout raiz**: Inter via `next/font`, `themeInitScript` no `<head>` (dark mode sem piscar),
  `suppressHydrationWarning` no `<html>` (tema) e no `<body>` (extensões de navegador).
- **Auth no cliente**: `session.ts` isola o armazenamento do token (localStorage hoje, trocável);
  `useRequireAuth` manda para `/login?next=…` lendo `window.location` (não `useSearchParams`).
- **App shell**: guarda de sessão; navegação na barra superior no desktop (lista com muitas colunas
  precisa da largura), drawer no mobile. `nav-config.ts`: item com `roles`, `NEXT_PUBLIC_HIDDEN_NAV`
  para esconder menus numa apresentação (**cosmético**, a rota continua acessível),
  `OFF_MENU_ITEMS` para títulos de telas fora do menu, `activeNavItem()` por prefixo mais longo.
- **`vercel.json`**: install e build a partir da raiz (`cd ..`), compila o shared antes, cabeçalhos
  de segurança (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`).
- **`next.config.ts`**: `transpilePackages: ['@<proj>/shared']`.
- **ESLint**: plugins `@next/next`, `react-hooks` e `jsx-a11y` registrados à mão, pegando só as
  `rules` dos presets (os presets mudam de formato entre versões). Instalar desde o primeiro dia.

### 5.2 Design system — molde: `docs/DESIGN_SYSTEM.md` + `frontend/src/app/globals.css`

- Tokens em **OKLCH** no `globals.css` (`:root` e `.dark`), mapeados por `@theme inline`;
  `@custom-variant dark (&:is(.dark *))`.
- Só utilitários semânticos: `bg-background`, `bg-card`, `bg-primary`, `text-muted-foreground`,
  `border-border`, `success`/`warning`/`destructive`/`info`. **Nada de `blue-500` ou hex em tela.**
- Cores de marca em tokens separados (`--brand-*`), usadas só em peças de marca (logo, login,
  formulário público, etiqueta).
- Primitivos em `components/ui/`: button (variantes + `asChild` via `slot`), input, label, select,
  select-menu, textarea, switch, card, badge, table, skeleton, separator, avatar, spinner, tooltip,
  dropdown-menu, dialog, confirm-dialog (`useConfirm()` → `Promise<boolean>`), toaster
  (`toast.success/error/warning/info`), theme-toggle, empty-state, page-header, back-link,
  form-error, pagination, tabs, **lookup** (digita para filtrar, só seleciona, cadastra no rodapé),
  save-indicator.
- Padrões de página: **lista** (`PageHeader` → filtros → `Card` + `Table` → `Pagination`,
  `Skeleton` e `EmptyState`), **criar/editar** (`BackLink` + `PageHeader` → `Card` com form
  reutilizável), **detalhe** (vários cards: dados + relacionados + atividade), **destrutivo** via
  `useConfirm({ variant: 'destructive' })`, feedback via `toast` (nunca `alert`/`window.confirm`).
- Enum na tela = mapa `LABELS` + mapa `VARIANT` (+ `DOT` para cor) + componente de badge
  (molde: `frontend/src/lib/cases/status-meta.ts`).

---

## 6. Regras transversais (quebrar qualquer uma é bug)

1. **Auditoria de tudo** — toda escrita gera `AuditLog` imutável, automaticamente pela extensão;
   eventos semânticos (`LOGIN`, `LOGOUT`, `EXPORT`) explicitamente pelo `AuditService`.
2. **Soft delete** — nada é apagado fisicamente; `deletedAt` + filtro explícito; excluir só `ADMIN`.
   No SafeKeep a ação na UI passou a se chamar **"Archive"**, não "Delete".
3. **RBAC na API e na UI** — `ADMIN` e `EMPLOYEE`; dado sensível (lá, valor financeiro) **não sai
   da API** para quem não pode ver: o use case devolve `null`, não é filtro de tela.
4. **Prisma não vaza** para `application`/`presentation`.
5. **Tipos não se duplicam** — contrato novo entra em `packages/shared`.
6. **Nada de texto livre** onde couber conjunto finito: **enum** (muda só com deploy), **CatalogItem**
   (lista que a operação mantém — grava `code`, mostra `label`) ou **tabela própria com FK** (quando
   tem hierarquia). A tela usa `Lookup`, que deixa cadastrar o item que falta sem sair do form.
   Continuam livres de propósito: notas, modelo, série, endereço.
7. **Sem botão "Salvar"** nas telas de edição — texto grava no blur, select e toggle na hora.
8. **Frontend só com tokens** do design system.
9. **Mensagem ao usuário no idioma da UI; comentário de código em PT-BR; código e dados 100% em
   inglês.**

---

## 7. Harness do Claude Code

### 7.1 A camada de contexto (tudo versionado no repositório)

| Arquivo | Papel |
|---|---|
| `CLAUDE.md` (raiz) | projeto, estrutura, stack travada, regras transversais, "como trabalhar", referências; no topo, o aviso "retomando? leia `docs/HANDOFF.md` primeiro" e a regra de idioma |
| `backend/CLAUDE.md` | camadas, convenções, auditoria, soft delete, RBAC, Docker, comandos, **Definition of Done**, **o que NÃO fazer** |
| `frontend/CLAUDE.md` | princípios, organização real das pastas, convenções, DoD, o que não fazer |
| `VERSOES.md` | versões propostas × **as-built**, com a justificativa de cada desvio |
| `docs/HANDOFF.md` | **documento-mestre**: o que é o produto, estado real (pronto × não feito, e por quê), como rodar, gotchas, fluxos para conhecer antes de mexer, perguntas em aberto, regras de trabalho |
| `docs/ARQUITETURA.md` | o padrão **em vigor**, com código real, e uma seção de inconsistências para o Pedro decidir |
| `docs/DESIGN_SYSTEM.md` | tokens, primitivos, padrões de página, como verificar UI |
| `docs/decisoes-e-perguntas.md` | log `[DECISÃO]` (o que decidi sozinho, por quê, como reverter) e `[PERGUNTA]` (espera o Pedro), marcando `✅ RESPONDIDO` quando fecha |
| `docs/BACKLOG.md` | o que falta, em P0 (trava entrega) → P3 (dívida), com "quem resolve" |
| `docs/DEPLOY.md` | passo a passo de produção, com as armadilhas de cada painel |
| `docs/PERGUNTAS_<CLIENTE>.md` | perguntas para o cliente em português informal, 🔴 nas que travam código, palpite entre parênteses |
| `docs/jira-import.csv` | backlog importável no Jira (épicos + issues) |
| `docs/legado/` | especificação **extraída** dos materiais do cliente (os prints ficam fora do repo) |
| `docs/templates/new-module.md` | template de módulo Clean Architecture |
| `docs/PROMPT_PROXIMO_AGENTE.md` | prompt autossuficiente para abrir um agente novo |
| `PROMPT_INICIAL_CLAUDE_CODE.md` | prompt da primeira sessão + guia de condução por fases |
| `specs/<feature>.md` | objetivo, escopo (incluído × fora), regras de negócio, modelo de dados, tabela da API (método/rota/quem), RBAC, auditoria, **critérios de aceitação em checklist**, camadas a entregar |
| `.claude/launch.json` | configuração de preview do frontend via `wsl.exe` |

Ordem de leitura para quem entra: `HANDOFF.md` → `CLAUDE.md` → `ARQUITETURA.md` → material do
cliente → `DESIGN_SYSTEM.md` → `DEPLOY.md`.

### 7.2 Como o SafeKeep nasceu (sequência que funcionou)

1. **Camada de contexto antes do código**: `CLAUDE.md` por nível, `VERSOES.md`, `docs/`, `specs/`,
   template de módulo e um `schema.prisma` inicial.
2. Primeira sessão: ler tudo, devolver o entendimento, apontar ambiguidades, **propor o plano da
   Fase 0 em checklist** antes de codar.
3. Fase 0 — fundação: monorepo, shared, backend em camadas, Prisma, auth JWT + RBAC, auditoria,
   erros, Swagger, health, Dockerfile, compose, frontend base, Jest, scripts do turbo.
4. Auth + Users → **Customers ponta a ponta como módulo de referência** → demais módulos copiando o
   padrão → deploy com seed de demonstração.

### 7.3 A regra de ouro do Pedro para documentação

> "A documentação vive no repositório — não em conversa ou memória de ferramenta." (README do SafeKeep)

O design system chegou a viver só na memória local da IA e teve de ser reescrito no repo. Memória
do Claude serve para preferências de trabalho; conhecimento de projeto vai para `docs/`.

### 7.4 O que faltou no harness do SafeKeep — fazer no Locamania desde o dia 1

- **`frontend/CLAUDE.md` com o nome certo.** No SafeKeep ele ficou como `frontend/CLAUDE-FRONT.md`
  (o próprio arquivo diz "deve ficar em `frontend/CLAUDE.md`"), então o Claude Code **nunca o
  carregou sozinho**. Ele também contradiz o `DESIGN_SYSTEM.md` ao falar em "shadcn/ui (Radix)".
- **Skill de "novo módulo"** em `.claude/skills/`. Foi sugerida duas vezes (no template e no prompt
  inicial) e nunca criada; o template envelheceu e passou a contradizer o código.
- **Template de módulo fiel ao código** (repositório recebe dados planos) — ver §10.1.
- **`.claude/settings.json` do projeto** com permissões para os comandos de rotina (`pnpm`,
  `docker compose`, `curl localhost`, `git status/diff/log`) para não parar em prompt de permissão.
- **Um único documento de estado.** `HANDOFF`, `ESTADO_DO_PROJETO` e `BACKLOG` chegaram a divergir;
  a solução foi o `HANDOFF` virar mestre e o `ESTADO` virar ponteiro. Começar já assim.
- **Glossário do cliente antes do schema** — ver §10.1, item de renames.

---

## 8. Infra, ambiente e deploy

### 8.1 Dev local (WSL2 + Docker Desktop)

- Projeto **dentro do filesystem do Linux** (`~/projetos/…`), Docker Desktop com *WSL Integration*.
- `docker compose up -d postgres mailpit && pnpm dev` sobe tudo: backend `:3001` (Swagger `/docs`,
  `/health`), frontend `:3000`, shared em watch, Mailpit em `:8025`.
- Primeira vez: `pnpm install && pnpm --filter @<proj>/shared build && pnpm --filter backend
  prisma:deploy && pnpm --filter backend db:seed`.
- Contas de dev da seed: `admin@<proj>.local` / `funcionario@<proj>.local`, senha `changeme123`.

### 8.2 Produção (camada gratuita) — molde: `docs/DEPLOY.md`

Ordem obrigatória: **push → banco → API → frontend**.

| Peça | Detalhe que custou tempo |
|---|---|
| **Supabase** | `DATABASE_URL` = *transaction pooler* 6543 com `?pgbouncer=true` (`&connection_limit=1` no Render); `DIRECT_URL` = **session pooler** 5432. **Não usar a "Direct connection"**: no free ela só responde por IPv6 e o WSL não conecta. Região igual à da API |
| **Render** | Blueprint pelo `render.yaml`. Se criar à mão, **Root Directory vazio** (o Dockerfile precisa do contexto da raiz). Free não tem `preDeployCommand`: migration **à mão** antes do deploy (de propósito fora do start do container). Dorme após ~15 min; primeira chamada leva 30–50 s |
| **Vercel** | Root Directory `frontend`; `NEXT_PUBLIC_API_URL`. Toda `NEXT_PUBLIC_*` entra no build: mudar exige redeploy |
| **GitHub privado** | Render e Vercel pedem para instalar o app deles; escolher "Only select repositories" |
| **CORS** | `CORS_ORIGIN` sem barra no fim. Sintoma: `/health` responde e o login falha |
| **E-mail** | fora do caminho crítico: a API sobe sem SMTP. Resend (100/dia). Sem SPF + DKIM, cai em spam |
| **URL pública da API** | vem do próprio Render (`fromService` no blueprint / `RENDER_EXTERNAL_URL`). Quando dependia de variável criada à mão, o e-mail saiu apontando para `localhost` |
| **Backup** | `.github/workflows/backup.yml` + `scripts/backup-db.sh` (verifica que o dump abre e tem as tabelas principais); segredo `DATABASE_URL_BACKUP` com o session pooler |
| **Seed remota** | contra o Supabase leva minutos (~70 ms por ida e volta) |
| **Primeiro acesso** | trocar a senha do admin: a da seed está no repositório |

Script de conveniência: `scripts/setup-supabase.sh "<pooler-6543>" "<session-5432>"` confere as
URLs antes de migrar e popular.

---

## 9. Como o Pedro trabalha (processo)

- Manda **vários pedidos de uma vez, sem ordem**; espera que eu **priorize e execute até o fim**,
  inclusive por horas sem interação. Nunca terminar pedindo "continue".
- **Resposta consolidada ao fim de cada bloco**, não a cada passo. Decisão de escopo que eu tomar
  sozinho vai **explícita no resumo**, com o motivo.
- **Uma fatia vertical por vez**, ponta a ponta, **verificada rodando de verdade** (HTTP, tela), não
  só typecheck.
- **Commit por bloco**, Conventional Commits **em PT-BR**, dizendo o **porquê**:
  `feat(cases): criar um case usa a mesma tela de quem já existe`,
  `fix(render): o blueprint preenche a URL pública da API sozinho`. Rename grande em commits
  numerados (`refactor(1/3): …`). Branches `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Antes de PR: `pnpm typecheck` e `pnpm test` verdes. Ao fechar uma fatia: atualizar `HANDOFF.md` e,
  se houver decisão nova, `decisoes-e-perguntas.md`.
- **Nunca derrubar o servidor que ele está usando**: checar `curl --max-time 3` em `/health` e na tela
  de login antes de subir; `EADDRINUSE` = já está rodando; nada de `pkill` em `nest start`/`next dev`
  sem confirmar; espera com teto (~45 s) e diagnóstico pelo log; servidor de watch como tarefa de
  fundo do harness.
- **Conversa em português.**
- Ele revisa o que foi gerado por IA: quer, num momento dedicado, a revisão de padrões e
  arquitetura **com o porquê de cada decisão**.
- As perguntas ao cliente passavam pelo Davi, que tem contato direto com o dono da Safekeep — daí
  o arquivo de perguntas em PT-BR informal.
- **Respostas curtas, em tópicos, sem tecniquês**: *"me responde em topicos, sem muitas palavras,
  quero so bater o olho"* (24/08).
- **Perguntas para o cliente** em PT-BR informal, entregues como **bloco de texto para colar**, não
  como arquivo `.md` (24/08).
- **Quando ele não está: decidir, anotar o porquê e seguir** — *"anote e amanhã de manhã cedo eu vejo
  e decido... mas não interrompa"* (01/09).
- **Execução longa → página de acompanhamento em HTML (artifact)**, atualizada durante o trabalho,
  com seção de decisões. Foi assim que 19 correções saíram numa noite (01/09). Guia de painel
  campo a campo (Render/Vercel) em artifact também funcionou — *"ficou perfeito"* (28/08).
- **Autonomia máxima em operação**: *"faz o push, configura os envs, roda todos os comandos e me
  passa o mínimo pra eu fazer"* (28/08). **Procurar credenciais no `.env` antes de pedir** (26/08).
- **Jira com absolutamente tudo** — feito, em andamento, não aprovado e backlog — cada item detalhado
  e com os pontos em aberto explícitos (24/08).
- Push na `main` dispara deploy automático: **migration no Supabase antes do push**, com backup.
- Entregáveis para ele abrir vão para a pasta do projeto ou viram artifact — **o navegador dele não
  abre arquivos do scratchpad** (05/09). Anexo no chat só aceita imagem; `.pdf`/`.docx` chegam pelo
  caminho `/mnt/c/Users/pedro/Downloads/…`. Script interativo não roda pelo botão Run (sem TTY).
- Em 23/08 ele disse que queria um CLAUDE.md novo, *"um harness mais atual e eficiente"*, com
  controllers, services e o jeito de fazer telas definidos de antemão, como no trabalho, e que tem
  *"um modelo de estrutura melhor que o atual"*. **Esse modelo ainda não foi visto** — pedir antes
  de fixar a estrutura do Locamania.

---

## 10. Lições aprendidas

### 10.1 Dívidas do SafeKeep que o Locamania deve decidir na fundação

| # | O que aconteceu | O que fazer no Locamania |
|---|---|---|
| 1 | **Template contradiz o código**: o template tinha `create(thing: Thing)` + `Thing.create()`; o código inteiro usa `create(data)` e nenhuma factory | escrever o template (e a skill) já no padrão real, ou decidir por domínio rico antes do primeiro módulo |
| 2 | **Entidades quase anêmicas** (getters + regras estáticas); o que funcionou muito bem foram as regras em **funções puras com teste** | assumir oficialmente "regras em funções puras + use case orquestra", ou domínio rico — escolha consciente, escrita no `CLAUDE.md` |
| 3 | **Mensagens de erro do domínio em PT-BR chegavam à tela** do usuário canadense; corrigido depois traduzindo tudo | decidir no dia 1: mensagem no idioma da UI, ou **código de erro estável** + tradução no front (prepara i18n) |
| 4 | **JWT em `localStorage`** (exposto a XSS); cookie httpOnly implementado depois e desligado até ter domínio próprio | planejar `app.` e `api.` no mesmo domínio desde cedo e ligar o cookie no go-live |
| 5 | **Next usado como SPA** (tudo `'use client'` + TanStack) | ok para sistema atrás de login; decidir de propósito o que é público e renderizado no servidor |
| 6 | **Corrida na geração de código sequencial** (checa e depois grava) | `UNIQUE` no banco + retry no conflito |
| 7 | **Duplicações**: envelope de paginação montado à mão em cada controller; `qs()` reescrito em cada `lib/api/*` (filtro novo esquecido é ignorado sem erro); guarda de rota ADMIN repetida por página | helpers compartilhados desde o início (`paginate()`, `toQueryString()` genérico, layout/guard de rota por papel) |
| 8 | **Dois padrões para tabela de apoio** (`MediaType`/`CaseType` como tabelas, depois `CatalogItem`) | `CatalogItem` desde o primeiro catálogo |
| 9 | **Auditoria só na aplicação**: escrita direta no banco não é auditada. A empresa do Pedro usa triggers PL/pgSQL | decidir: extensão do Prisma (copiar pronta) agora e trigger depois, ou trigger desde o início |
| 10 | **Prisma 6, não 7**: o 7 muda a conexão (driver adapters, `prisma.config.ts`) e a auditoria depende da extensão | projeto novo não tem legado: avaliar começar no 7 **ou** ficar no 6 para copiar a fundação sem adaptar. Decidir antes da Fase 0 |
| 11 | **Lint do frontend quebrado**: a config dizia usar `eslint-config-next`, que nunca foi instalado | instalar e registrar `@next/next`, `react-hooks`, `jsx-a11y` na Fase 0 |
| 12 | **Renames tardios caros**: `ServiceOrder → Case`, `Device → Drive`, `Partner → Reseller`… e depois **`Reseller → Partner` de volta** | fechar o **glossário com o cliente antes do schema** e usar o vocabulário dele desde o primeiro commit |
| 13 | **Regra de negócio suposta** (prazo em dias corridos 3/5/9) quando o documento real do cliente dizia dias **úteis** | extrair regras dos documentos reais do cliente (formulários, PDFs, termos) antes de codar; o que for palpite vai como `[PERGUNTA]` |
| 14 | **Decorator órfão**: ao remover o campo `city` do `CreateCustomerRequestDto`, os decorators `@ApiPropertyOptional` + `@IsOptional` ficaram e grudaram em `origin` — o campo obrigatório passou a aceitar ausência (e o Prisma estoura 500) | ao remover um campo de DTO, remover os decorators junto; teste de validação do request |
| 15 | **Status como enum de código** quando o cliente avisou que a lista ia crescer | perguntar cedo se status/transições são configuráveis pelo cliente |

### 10.2 Gotchas técnicos (cada um custou pelo menos uma rodada)

**Build e monorepo**
- `.tsbuildinfo` copiado para a imagem fazia o `tsc` achar que já tinha emitido: o `dist` do shared
  não existia e o backend não resolvia `@<proj>/shared`. Correção: `**/*.tsbuildinfo` no
  `.dockerignore` e `incremental: false` no tsconfig do shared.
- Prisma em Alpine quebra por OpenSSL/musl: usar `node:24-bookworm-slim` + `openssl`.
- CRLF vindo do Windows gerou um commit com ~1700 linhas "alteradas" sem mudança real: por isso o
  `.gitattributes` com LF.
- Flat config do ESLint não herda de pastas acima: cada app importa a base.

**Prisma e banco**
- `Decimal`/`Date` quebravam a serialização da auditoria e o `try/catch` engolia — escritas com
  dinheiro não eram auditadas. `jsonSafe()` resolve.
- `prisma migrate dev` é interativo e pode propor apagar dados. Caminho seguro: `prisma migrate diff
  --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` → revisar →
  `prisma db execute` → `prisma migrate resolve --applied` → `prisma generate`. **Sem
  `--from-url`, o diff gera o banco inteiro.**
- **Rename nunca pelo diff** (vira `DROP` + `ADD` e perde dado): `ALTER TABLE … RENAME`,
  `ALTER TYPE … RENAME VALUE`, conferir com `grep -E "DROP|DELETE"` antes de rodar, e atualizar
  `AuditLog.entityType` (guarda o nome do model como texto).
- Palavra reservada: `case` em JS (verificar declarações antes de renomear) e `"Case"` com aspas no
  SQL.
- O backend não reconecta sozinho quando o Postgres volta: reiniciar o backend.

**Next / frontend**
- Servir com `next dev`, não `next start`; não rodar `next build` com o `next dev` de pé (os dois
  usam `.next`), senão o CSS volta 404.
- `useSearchParams()` sem Suspense quebra o build estático do Next 16.
- Aviso de hidratação por extensão de navegador (`cz-shortcut-listen`): `suppressHydrationWarning`
  no `<body>`.
- Turbopack não recompila `globals.css` com `touch`: precisa de mudança real de conteúdo. Conferir
  o CSS servido antes de tirar screenshot.
- Agrupar datas por **dia local**, não UTC (prazo às 21h cairia no dia seguinte).
- Lista com teto de 100 itens: **avisar** quantos ficaram de fora em vez de truncar calado.
- CSV: BOM com escape (`﻿`), não o caractere literal no fonte.

**Produto e integrações**
- E-mail é **notificação, não transação**: falha nunca desfaz o que foi gravado.
- Cliente de e-mail não renderiza SVG nem `data:` URI: imagem (código de barras) servida como PNG
  por uma rota da API.
- Link de e-mail **só lê**; a ação é POST autenticado — antivírus e clientes de e-mail abrem links
  sozinhos, e aprovação por GET criaria registro fantasma.
- Resposta pública é uma **projeção estreita** (sem nota interna, ids de banco, nome de quem
  trabalha), com rótulos próprios para quem está de fora.
- Alertas **calculados na leitura**, nunca gravados: mudar um prazo corrige tudo sozinho.
- Anexos: reduzir a imagem no navegador antes de subir; bytes no banco porque o disco do Render é
  efêmero.
- Mailpit é assíncrono: esperar um segundo antes de consultar.

**Ambiente (WSL2)**
- Docker Desktop parado = Postgres fora = "o app não funciona". Checar `docker ps` antes de
  investigar código. Dá para iniciar pelo interop:
  `nohup "/mnt/c/Program Files/Docker/Docker/Docker Desktop.exe" >/dev/null 2>&1 &` (~30 s).
- Shell não interativo pode pegar o Node do apt em vez do nvm: ativar o nvm explicitamente.
- O preview MCP não anexa ao servidor atrás do wslrelay: verificar por `curl` + log do dev server +
  Chromium headless.
- Chromium headless sem sudo: `npx playwright-core install chromium --only-shell`, `apt-get download
  libnspr4 libnss3 libasound2t64`, `dpkg-deb -x` num diretório local e `LD_LIBRARY_PATH` apontando
  para ele.
- Material de terceiros (prints do sistema legado) **fora do repositório**; versionar só a análise.
- Depois de reboot, o PATH volta para o Node 18: usar o nvm v24.
- **Encerrar os processos que eu subi** ao terminar: um `next dev` e dois `nest start --watch`
  esquecidos fizeram o `pnpm dev` dele falhar (05/09).

**Mais gotchas (tirados das conversas)**
- Prisma: redirecionar o stdout para gerar a migration gravou o aviso *"package.json#prisma is
  deprecated"* **dentro do SQL**. Um `db push` que nunca virou migration fez o diff propor `DROP` de
  coluna inexistente. A cadeia de migrations nunca tinha rodado do zero: **testar replay em banco
  vazio + `migrate diff` vazio antes de deployar**. Seed remota: usar `createMany`.
- Render: a sincronização do Blueprint **descarta env var criada à mão no painel** — declarar tudo
  no `render.yaml`. `fromService` com `property: host` vem sem esquema: acrescentar `https://`.
- A dependência Render ↔ Vercel é circular (CORS precisa da URL do front, o front precisa da URL da
  API): um dos lados começa com URL provisória.
- Resend sem domínio verificado só entrega para o e-mail do dono da conta (erro 550). Render e Vercel
  não enviam e-mail sozinhos: é SMTP com a chave do Resend como senha.
- Leitor de código de barras é um "teclado rápido": distinguir pelo intervalo entre teclas e tornar a
  leitura idempotente. Validar o Code 128 gerado decodificando de verdade; a seed usa o mesmo
  alfabeto do gerador.
- `overflow-hidden` do `<aside>` cortava o botão de recolher a sidebar: botão fora do aside.
- `.next/types` guarda rotas antigas depois de rename: limpar o cache.
- `window.print()` imprime a página inteira: gerar um documento próprio para etiqueta/fatura.

### 10.3 Correções de rumo do Pedro (o que errei e a regra por trás)

| Regra | Evidência |
|---|---|
| **Não repetir pergunta já respondida** nem insistir no que depende dele e ficou para depois | *"já disse que não tenho mais prints, pq a insistência?"*; *"essa parte de dns vai ficar pra bem depois. não fica me pedindo agora"* (23/08) |
| **Conferir o estado real antes de cobrar ação dele** (ex.: `git ls-remote`/`git fetch`, não a config local) | *"eu já dei push DUAS vezes. acha um jeito pra verificar isso direito"* (23/08) |
| **Não rebaixar requisito a "dívida técnica" por conta própria** | *"eu ainda não to contente. exatamente a mesma tela de um case existente é a que tem que abrir quando eu clico em new case"* (05/09) |
| **Aplicar a regra literal por inteiro**; exceção inevitável = desvio mínimo e fiel à fonte, sem inventar campo | *"eu tinha te dito que todos os campos devem ser obrigatórios"*; *"pra que tu adicionou isso?"* (05/09) |
| **Fidelidade total ao documento-fonte**: termos exatos, mesmas colunas, mesma ordem, inclusive as ações do print | *"os termos descritos nela sejam exatamente o que tá escrito aqui"* (01/09) |
| **Tela grande já pedida não fica atrás de ajuste pequeno** que chegou depois | *"pq não fez ainda? implementa tudo que eu to te pedindo agora"* (24/08) |
| **Executar em vez de explicar limitação ou plano** | *"o que te impede de fazer tudo se você sabe tudo o que precisa ser feito?"* (24/08) |
| **Conferir no navegador antes de dizer "pronto"** | *"ainda vejo 'delete' no case do cliente"* (01/09) |
| **Mudança visual global: mostrar variantes lado a lado antes de aplicar** (a paleta foi e voltou três vezes) | *"antes ele tava bom pq era bem minimalista"* (26/08) |

### 10.4 Preferências de UI/UX que se repetiram

- **Minimalismo**: interface azul e neutros cinza; cor de marca só no logo/wordmark; logo branco e
  sem caixa no login.
- **Menus mínimos**: poucos itens no topo, Settings à direita; o que não se usa sai do menu (continua
  acessível por URL). Dentro de Settings, a aba de listas vem primeiro.
- **Home = a lista principal** (com calendário ao lado), sem dashboard. Clicar num dia filtra.
- **Lista**: largura total; linha inteira pintada pela cor do status (configurável em Settings);
  concluídos neutros; poucas colunas; texto longo quebra linha; booleano como `Y` / `-`; **colunas
  configuráveis por usuário** (modo de edição, arrastar para reordenar, checkboxes, salvo no banco).
- **Detalhe**: tudo visível sem rolagem, dividido em abas, painel lateral recolhível; abre sempre na
  primeira aba.
- **Criar = a mesma tela do detalhe, vazia**: campos desabilitados até escolher o registro-pai,
  opção de cadastrar ali mesmo, e salva incompleto se qualquer campo tiver valor.
- **"Archive" no lugar de "Delete"** em todo lugar (inclusive "Remove" esquecido).
- **Parâmetros self-service**: a operação configura taxas, prazos, cores e listas sem deploy.
- **Campo categórico**: filtra ao digitar, não aceita texto fora da tabela, cadastra o novo ali mesmo.
- **"Voltar" retorna à origem** (de onde veio), não a uma lista qualquer.
- **Termos longos abertos na página**, sem caixa com rolagem.
- **Formulário público**: todos os campos obrigatórios, com máscara.
- **Sistema que substitui outro**: copiar fluxo, nomenclatura e agrupamento de campos (memória
  muscular dos usuários); o acabamento é o nosso.
- **Seed grande e realista** para demonstração.
- Nomenclatura oscila: **centralizar os labels** para renomear barato.

### 10.5 Harness observado nas sessões

- Auto mode ligado desde 23/08 — foi o que permitiu a noite inteira de trabalho sem paradas.
- `git push` bloqueado por permissão no início; liberado nas permissões do projeto depois.
- `/compact` é comando dele; eu não consigo disparar.
- O MCP do Atlassian caiu numa sessão e o backlog foi por CSV; **nesta sessão do Locamania ele está
  carregado** (Jira/Confluence disponíveis).
- Não havia hooks, `settings.json` de projeto nem skills próprias — é o que o §7.4 propõe criar.

---

## 11. O que o Locamania precisa decidir antes da Fase 0

O padrão acima é genérico. Estas respostas mudam o `CLAUDE.md`, o schema e a configuração:

1. **O que é o Locamania**: negócio, quem usa, o que substitui (sistema legado? planilha? papel?),
   se é para um cliente ou produto próprio.
2. **Idioma e locale da UI**: no SafeKeep era en-CA/CAD por ser de Vancouver. Aqui pode ser pt-BR/BRL
   (máscaras de CPF/CNPJ, CEP, telefone). Código em inglês e comentários em PT-BR continuam?
3. **Papéis e dado sensível**: `ADMIN`/`EMPLOYEE` bastam? O que o `EMPLOYEE` não pode ver
   (o equivalente ao "financeiro oculto")?
4. **Lei de dados**: LGPD em vez de PIPA/PIPEDA muda o cuidado com logs, Sentry e backup.
5. **Deploy**: mesma trinca gratuita (Supabase + Render + Vercel)? Região próxima dos usuários.
6. **Prisma 6 ou 7** e **auditoria por extensão ou por trigger** (§10.1, itens 9 e 10).
7. **Erros**: mensagem no idioma da UI ou código estável traduzido no front (§10.1, item 3).
8. **Repositório**: `github.com/opedrogouveia/locamania` privado?
9. **Materiais do cliente**: prints, formulários, PDFs, planilhas — para extrair regras e glossário.


> **Decidido (Pedro, 24/09/2026):** o Locamania é um **sistema de locação** e segue **o mesmo
> padrão do SafeKeep** — stack, estrutura e harness — por seguir boas práticas e ter as stacks
> atualizadas. O que muda são só as correções das dívidas de §10.1 e o que o domínio novo exigir.

---

## 12. Checklist da Fase 0 (com os moldes)

- [ ] Camada de contexto: `CLAUDE.md` raiz + `backend/CLAUDE.md` + **`frontend/CLAUDE.md`**,
      `VERSOES.md`, `docs/HANDOFF.md`, `docs/ARQUITETURA.md`, `docs/DESIGN_SYSTEM.md`,
      `docs/decisoes-e-perguntas.md`, `docs/BACKLOG.md`, `docs/templates/new-module.md` (no padrão
      real), `specs/` das primeiras fatias, glossário do cliente.
- [ ] Harness: `.claude/settings.json` (permissões de rotina), `.claude/skills/new-module/`,
      `.claude/launch.json`.
- [ ] Raiz: `package.json`, `pnpm-workspace.yaml` (com `allowBuilds`), `turbo.json`,
      `tsconfig.base.json`, `eslint.config.mjs`, Prettier, `.npmrc`, `.gitignore`,
      `.gitattributes` (LF), `.dockerignore` (com `*.tsbuildinfo`), `.env.example` comentado.
- [ ] `packages/shared`: `enums/`, `contracts/{pagination,error,auth,user}.ts`, build CommonJS sem
      incremental.
- [ ] Backend: `main.ts`, `app.module.ts`, `shared/{config,cls,prisma,errors,auth,security,health,http,observability,mail}`,
      módulos `audit`, `auth`, `users`, `activity`; `schema.prisma` com `User`, `AuditLog`,
      `AppParameter`, `CatalogItem`; primeira migration; seed determinística; Jest.
- [ ] Helpers que faltaram no SafeKeep: `paginate()`, `toQueryString()` genérico, guarda de rota por
      papel.
- [ ] `backend/Dockerfile` (bookworm-slim, contexto na raiz), `docker-compose.yml` (postgres +
      mailpit + api), `render.yaml`.
- [ ] Frontend: `layout.tsx`, `providers.tsx`, `globals.css` (tokens), `components/ui/*`,
      `components/layout/*`, `lib/api/client.ts`, `lib/auth/*`, `lib/utils.ts` (locale do projeto),
      login, ESLint com os plugins, `vercel.json`, `next.config.ts`.
- [ ] Ops: `scripts/backup-db.sh`, `.github/workflows/backup.yml`, `docs/DEPLOY.md`.
- [ ] Verificação: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `docker build`, login
      ponta a ponta com as duas contas, `/health`, Swagger, auditoria gravando o LOGIN.
- [ ] Depois: Auth + Users → **primeiro módulo de negócio completo como referência** → os demais.
