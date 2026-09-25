# CLAUDE.md — Raiz (Locamania)

> 🚦 **Retomando o desenvolvimento? Leia [`docs/HANDOFF.md`](docs/HANDOFF.md) primeiro** (estado real,
> como rodar) e [`docs/PLANO_MVP.md`](docs/PLANO_MVP.md) (o que falta, na ordem — o primeiro checkbox
> vazio é o próximo passo). Padrão de código: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md). Telas:
> [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).
>
> 🌐 **Idioma (permanente):**
> - **UI e mensagens ao usuário: pt-BR**, datas `dd/mm/aaaa`, moeda **BRL**, fuso **America/Sao_Paulo**.
> - **Código, dados e rotas: 100% inglês** — identificadores, arquivos, tabelas/colunas, enums, chaves JSON, valores gravados.
> - **Comentários de código e documentação: pt-BR.**
> - **Conversa com o Pedro: português.**

Cada app tem o seu: [`backend/CLAUDE.md`](backend/CLAUDE.md) e [`frontend/CLAUDE.md`](frontend/CLAUDE.md).

## Projeto

Sistema de gestão da **Locamania**, locadora de **motos**: painel administrativo (proprietária e
equipe) + app do cliente (locatário), sobre a mesma API e o mesmo banco. Requisitos do cliente em
[`docs/REQUISITOS_CLIENTE.txt`](docs/REQUISITOS_CLIENTE.txt) (47 seções, citadas como §N).

Web **100% responsiva** (nada de app nativo no MVP), instalável no celular (PWA). A área do cliente
é pensada primeiro para o celular; o painel precisa ser impecável no PC **e** no celular.

## Estrutura

```
locamania/
  backend/          NestJS 11 (Clean Architecture) + Prisma 6 + PostgreSQL 17 + Dockerfile
  frontend/         Next.js 16 (App Router) + React 19 + Tailwind 4 — painel (/admin) e app (/app)
  packages/shared/  contratos de API, enums, permissões, rótulos pt-BR, regras puras (fonte da verdade)
  docs/             HANDOFF, PLANO_MVP, ARQUITETURA, DESIGN_SYSTEM, decisões, deploy, manuais
  scripts/          smoke test, backup
  .github/          CI, backup e agendador dos jobs
```

## Stack (travada — não trocar sem combinar)

pnpm 11 + Turborepo · TypeScript estrito · NestJS 11 · Prisma 6.19 · PostgreSQL 17 (Supabase em
produção) · JWT próprio · REST + Swagger · Next.js 16 + Tailwind 4 + TanStack Query 5 · Docker só no
backend · Render + Vercel + Supabase. Versões em [`VERSOES.md`](VERSOES.md).

## Regras que valem para o sistema inteiro (quebrar é bug)

1. **Auditoria de tudo** — toda escrita vira `AuditLog` automaticamente (extensão do Prisma). Não
   escreva código de auditoria de CRUD; eventos semânticos (login, exportação, comando) usam `AuditService`.
2. **Nada é apagado** — arquivamento com `deletedAt`; a tela diz "Arquivar". Leituras filtram `deletedAt: null`.
3. **Permissões na API, não só na tela** — toda rota da equipe declara `@RequirePermissions(...)`;
   rota do cliente declara `@CustomerRoute()` e **só usa o id do token**.
4. **Valor em dinheiro não sai da API** para quem não tem `payments.view` / `finance.view` (vira `null`).
5. **O cliente nunca vê dado de outro cliente** nem informação interna (custo, nota da equipe, id de usuário) — §46.
6. **Contratos em `packages/shared`** — o backend implementa, o frontend importa. Nada de tipo duplicado.
7. **Regra de negócio em função pura com teste** (`packages/shared/src/rules/` ou `domain/` do módulo), nunca no controller.
8. **Nada de texto livre** onde couber lista: enum (muda com deploy) ou `CatalogItem` (a operação mantém).
9. **Datas "só dia" como `YYYY-MM-DD`**; dinheiro como string decimal; "hoje" sempre pelo `ClockService`.
10. **Status derivado é calculado na leitura** (cobrança próxima, manutenção vencida) — o job só persiste atraso e dispara avisos.
11. **Integração externa sempre atrás de uma porta** (gateway, WhatsApp, rastreador, e-mail) com provedor sandbox.
12. **Nenhuma escrita crítica sem confirmação do servidor** (§35): offline, a tela avisa e bloqueia.

## Como trabalhar

- **Uma fatia vertical por vez** (shared → backend → frontend), verificada **rodando** (HTTP e tela), não só typecheck.
- Módulo novo: skill `/new-module` ou [`docs/templates/new-module.md`](docs/templates/new-module.md). Referência: `backend/src/modules/customers/`.
- **Commit por bloco**, Conventional Commits **em pt-BR**, dizendo o *porquê*. Nunca commitar `.env`.
- Ao fechar uma etapa: marcar o checkbox no `PLANO_MVP.md`, atualizar `HANDOFF.md`, registrar decisão nova em `docs/decisoes-e-perguntas.md`.
- **A documentação vive no repositório**, não na memória da ferramenta.

## Ambiente (não derrubar o que o Pedro está usando)

- Antes de subir: `curl -s -o /dev/null -w '%{http_code}' --max-time 3 localhost:3201/health` e `localhost:3200/login`. Respondeu → use o que está no ar.
- Nunca `pkill` em `nest`/`next` sem confirmar. `EADDRINUSE` = já está rodando. Espera com teto (~45 s), depois diagnostique pelo log.
- Portas: web **3200**, API **3201**, Postgres **5433**, Mailpit **8026** (distintas do SafeKeep, que convive na máquina).
- Ao terminar, encerre os processos que **você** subiu e não vai deixar rodando.

## Referências

| Documento | Para quê |
|---|---|
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | Estado real, como rodar, contas de demonstração |
| [`docs/PLANO_MVP.md`](docs/PLANO_MVP.md) | Escopo, decisões assumidas, etapas com checkbox |
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) | Padrão de código em vigor |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Tokens, componentes, padrões de tela, responsividade |
| [`docs/GLOSSARIO.md`](docs/GLOSSARIO.md) | Termo do negócio ↔ nome no código |
| [`docs/decisoes-e-perguntas.md`](docs/decisoes-e-perguntas.md) | Decisões e o porquê; perguntas em aberto |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Produção campo a campo |
| [`docs/HERANCA_SAFEKEEP.md`](docs/HERANCA_SAFEKEEP.md) | De onde veio o padrão e as lições aprendidas |
