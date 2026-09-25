# HANDOFF — Locamania

> **Documento-mestre.** Estado real, como rodar, o que falta. Atualizado ao fim de cada etapa.
> Ordem de leitura: este arquivo → [`PLANO_MVP.md`](PLANO_MVP.md) → [`../CLAUDE.md`](../CLAUDE.md) →
> [`ARQUITETURA.md`](ARQUITETURA.md) → [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).

## Estado atual (25/09/2026)

**MVP completo e rodando localmente**, com 12 meses de dados de demonstração. Etapas 0–12 do
[`PLANO_MVP.md`](PLANO_MVP.md) concluídas; falta só a entrega (13) — publicar seguindo o
[`DEPLOY.md`](DEPLOY.md) e revisar com a cliente.

| Área | Situação |
|---|---|
| Painel administrativo | todas as telas do §5.1 do plano, responsivas (390 px e 1440 px conferidos) |
| App do cliente (`/app`) | 9 telas, PIX com confirmação automática, aceite do contrato, informar km, suporte |
| API | 20 módulos, Swagger em `/docs`, validação e erros em pt-BR, auditoria de toda escrita |
| Banco | PostgreSQL 17, migration única (`init`), seed de produção + seed de demonstração |
| Permissões | 4 perfis com matriz editável; valores escondidos na API; cliente isolado (testado) |
| Deploy | Dockerfile testado em modo produção, `render.yaml`, `vercel.json`, CI verde no GitHub, rotinas e backup no Actions |
| Testes | 45 (regras do shared) + 29 (backend) + `scripts/smoke.mjs` (34 checagens, incluindo o aluguel completo) |

### Simulado (depende de conta/contrato de terceiro)
PIX (gateway sandbox com webhook assinado), WhatsApp (links `wa.me` com mensagem pronta),
rastreador (posições e comandos simulados). Cada um está atrás de uma porta: trocar é escrever um
adaptador. Ver [`DEPLOY.md`](DEPLOY.md) › Integrações e [`BACKLOG.md`](BACKLOG.md).

## Como rodar

```bash
docker compose up -d                                   # Postgres :5433 + Mailpit :8026
set -a && . ./.env && set +a && pnpm dev               # API :3201 + web :3200
```
Primeira vez / banco novo: ver [`../README.md`](../README.md). Regenerar a demonstração (apaga os
dados de negócio e recria 12 meses até hoje, ~7 s):
```bash
set -a && . ./.env && set +a && pnpm --filter @locamania/backend db:seed:demo
```

| Endereço | O quê |
|---|---|
| http://localhost:3200 | sistema (painel e app — mesmo login) |
| http://localhost:3201/docs | Swagger da API |
| http://localhost:8026 | e-mails enviados em dev (Mailpit) |

**Contas** (senha `changeme123`): `proprietaria@locamania.local` (Marina, tudo) ·
`admin@locamania.local` · `financeiro@locamania.local` · `funcionario@locamania.local` (sem valores) ·
cliente **CPF 529.982.247-25** (João Pedro da Silva, app do cliente).

## Verificar

```bash
pnpm typecheck && pnpm lint && pnpm test
node scripts/smoke.mjs            # só leitura; --write faz um aluguel completo (cria dados)
```

## Onde está cada coisa

- Regras de negócio puras: `packages/shared/src/rules/` (cronograma, encargos, manutenção, cliente).
- Módulo de referência do backend: `backend/src/modules/customers/`.
- Telas de referência do frontend: `frontend/src/app/admin/customers/**` e `app/admin/page.tsx`.
- Peças compartilhadas de tela: `components/ui/kit.tsx`, `data-table.tsx`, `components/shared/`.

## Pontos de atenção

- **Datas no navegador**: o campo de data é o nativo; em navegador configurado em inglês aparece
  `mm/dd/aaaa`. Em celular/PC em português aparece certo.
- **Arquivos no banco** (fotos/documentos em `bytea`, fotos reduzidas no navegador, máx. 8 MB): ok para
  o começo; migrar para storage quando o banco passar de ~300 MB (Supabase free = 500 MB).
- **Render free dorme**: primeiro acesso após 15 min demora ~50 s (ver RUNBOOK).
- Formas de pagamento são lista fixa (enum) — não há tela para editar.

## Próximos passos

1. Pedro: publicar seguindo [`DEPLOY.md`](DEPLOY.md) (Supabase → Render → Vercel → secrets do GitHub).
2. Apresentar à cliente (ambiente com dados de demonstração) e colher as respostas de
   [`decisoes-e-perguntas.md`](decisoes-e-perguntas.md) (perguntas abertas).
3. Escolher gateway PIX, WhatsApp e rastreador → adaptadores ([`BACKLOG.md`](BACKLOG.md)).
4. Antes do uso real: banco limpo (seed de produção), conta da proprietária com e-mail real, modelo
   de contrato revisado pelo advogado dela.

Operação e suporte pós-entrega: [`RUNBOOK.md`](RUNBOOK.md). Manual da cliente:
[`MANUAL_ADMIN.md`](MANUAL_ADMIN.md).
