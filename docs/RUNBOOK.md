# RUNBOOK — operação e suporte pós-entrega

> Para quem mantém o sistema no ar (Pedro). Como verificar, o que fazer quando algo dá errado,
> backup e restauração. Deploy inicial: [`DEPLOY.md`](DEPLOY.md).

## Onde olhar

| O quê | Onde |
|---|---|
| API no ar? | `https://<api>/health` → `"status":"ok"` e `database: up` |
| Erros e logs da API | Render → `locamania-api` → **Logs** (cada erro tem `correlationId`, o mesmo que a tela recebe) |
| Deploys do site | Vercel → projeto → **Deployments** |
| Banco (consultas, tamanho, backups do Supabase) | Supabase → **Table editor / SQL editor / Database → Backups** |
| Rotinas diárias e backup | GitHub → **Actions** (*Rotinas diárias*, *Backup do banco*) |
| Última execução das rotinas pela tela | Painel → Configurações → Sistema |
| Quem fez o quê | Painel → Histórico (auditoria de toda escrita, com usuário, data e IP) |
| E-mails enviados | Resend → **Emails** (status de entrega) |

## Verificação rápida (depois de deploy ou reclamação)

```bash
API=https://<api> OWNER_EMAIL=<email> PASSWORD='<senha>' node scripts/smoke.mjs
```
Só leitura. Confere saúde, login, permissões por perfil e isolamento do app do cliente.

## Incidentes comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Primeiro acesso do dia demora ~50 s | Render free dorme após 15 min | Normal no free. Resolver de vez: plano Starter (US$ 7/mês) |
| "Não foi possível falar com o servidor" em tudo | API fora (deploy falhou ou crash) | Render → Logs. Deploy com erro: *Rollback* para o anterior (Events → deploy verde → Rollback) |
| API não sobe: "Configuração de produção insegura" | segredo fraco/ausente ou `localhost` no CORS | ajustar a variável citada no Render → redeploy |
| Login funciona mas tudo dá erro de CORS no navegador | `CORS_ORIGIN` diferente do endereço do site | igualar ao domínio exato (com `https://`, sem barra) |
| Site abre, dados não carregam, banco "down" no /health | Supabase pausado (7 dias sem uso) ou senha trocada | Supabase → *Restore project*; conferir URLs |
| Lembretes/atrasos não atualizaram de manhã | workflow *Rotinas diárias* falhou | Actions → ver log → *Run workflow*; ou Painel → Configurações → Sistema → *Executar agora*. Rodar de novo não duplica nada |
| Cliente não recebeu e-mail | Resend sem domínio verificado / `MAIL_*` vazio | Resend → Emails; no sistema os avisos continuam no app e há o link do WhatsApp |
| Cliente esqueceu a senha | — | ele usa "Esqueci minha senha" com o CPF (e-mail) **ou** a equipe: ficha do cliente → *Reenviar acesso ao app* → link no WhatsApp |
| Funcionário saiu da empresa | — | Configurações → Usuários → desativar (encerra as sessões na hora) |
| "Sem permissão" para algo que deveria poder | matriz de permissões | Configurações → Permissões (só a proprietária) |
| Pagamento em dinheiro lançado errado | — | Pagamentos → cobrança → *Estornar pagamento* (com motivo) → lançar de novo. Fica no histórico |

## Backup e restauração

- **Automático**: todo dia 03:00 (GitHub Actions, 30 dias) + backups diários do próprio Supabase
  (free: 7 dias, em *Database → Backups*).
- **Manual**, a qualquer momento:
  ```bash
  DATABASE_URL="<session pooler 5432>" ./scripts/backup-db.sh ./backups
  ```
- **Restaurar** (num banco **vazio** — projeto Supabase novo, com as migrations NÃO aplicadas):
  ```bash
  gunzip -c locamania-AAAAMMDD-HHMM.sql.gz | psql "<session pooler 5432 do projeto novo>"
  ```
  Depois troque `DATABASE_URL`/`DIRECT_URL` no Render para o projeto novo e redeploy.
  Teste a restauração pelo menos uma vez antes de precisar dela (num projeto de teste).

## Segurança

- Trocar um segredo (`JWT_SECRET`) derruba todas as sessões — use se suspeitar de vazamento.
- Senhas: argon2id; login com limite de tentativas; sessões da equipe expiram em 12 h, do cliente em 30 dias.
- O app do cliente só lê dados pelo id do token (nunca pela URL) — testado no `smoke.mjs`.
- Nada é apagado de verdade: "Arquivar" esconde e mantém histórico (auditoria append-only).

## Rotina de suporte sugerida

- **Semanal**: olhar Actions (verde?), Logs do Render (erros repetidos?), tamanho do banco no Supabase
  (free: 500 MB — fotos são reduzidas antes de subir, mas vale acompanhar).
- **Mensal**: baixar um backup e guardar fora do GitHub; revisar usuários ativos.
- **A cada atualização**: `pnpm typecheck && pnpm test` local, migration aplicada antes do push,
  `smoke.mjs` depois do deploy.
