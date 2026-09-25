# Deploy — colocar a Locamania no ar (campo a campo)

> Tudo no plano **gratuito**: banco no **Supabase**, API no **Render** (Docker), site na **Vercel**,
> e-mail pela **Resend**, rotinas e backup no **GitHub Actions**. Nenhuma mudança de código é
> necessária — só contas, chaves e os campos abaixo. Tempo estimado: 40–60 min.

```
Celular / PC ──► Vercel (site: painel + app do cliente)
                   │  NEXT_PUBLIC_API_URL
                   ▼
                 Render (API NestJS, Docker) ──► Supabase (PostgreSQL)
                   ▲                         └─► Resend (e-mails)
GitHub Actions ────┘  08:00 rotinas diárias · 03:00 backup do banco
```

## 0. Antes de começar

- [ ] Repositório `opedrogouveia/locamania` com o código mais recente em `main`.
- [ ] Contas criadas (login com o GitHub em todas facilita): <https://supabase.com>,
      <https://render.com>, <https://vercel.com>, <https://resend.com> (opcional, para e-mail).
- [ ] Na sua máquina: o projeto rodando (README) — vamos aplicar as migrations daqui.
- [ ] Um gerador de segredos: `openssl rand -hex 32` (rode quantas vezes precisar).

Anote os valores numa nota segura enquanto avança. **Nunca** coloque segredos no repositório (ele é
público).

---

## 1. Banco — Supabase

1. **New project**
   - *Name*: `locamania`
   - *Database password*: gere uma forte e **guarde** (vai nas URLs abaixo)
   - *Region*: **South America (São Paulo)** — `sa-east-1`
   - *Plan*: Free
2. Espere o projeto ficar verde. Vá em **Connect** (botão no topo) → aba **ORMs** / *Connection string*:
   - **Transaction pooler** (porta **6543**) → vira o `DATABASE_URL`, acrescentando no fim
     `?pgbouncer=true&connection_limit=1`:
     ```
     postgresql://postgres.<ref>:<SENHA>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
     ```
   - **Session pooler** (porta **5432**) → vira o `DIRECT_URL` (migrations e backup):
     ```
     postgresql://postgres.<ref>:<SENHA>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
     ```
   > Senha com caractere especial (`@`, `#`, `/`…)? Codifique na URL (`@` → `%40`) ou gere outra só
   > com letras e números.

3. **Aplicar as migrations e criar a conta da proprietária** (da sua máquina, na raiz do projeto):

   ```bash
   export DIRECT="postgresql://postgres.<ref>:<SENHA>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
   cd backend
   DATABASE_URL="$DIRECT" DIRECT_URL="$DIRECT" npx prisma migrate deploy
   DATABASE_URL="$DIRECT" DIRECT_URL="$DIRECT" \
     SEED_OWNER_EMAIL="email-da-proprietaria@exemplo.com" \
     SEED_OWNER_NAME="Nome da Proprietária" \
     SEED_PASSWORD="uma-senha-provisoria-forte" \
     pnpm db:seed
   ```
   O seed é idempotente (pode rodar de novo). Ele cria os cadastros de referência (tipos de
   manutenção, marcas, tipos de documento, parâmetros) e a conta da proprietária. **Peça para ela
   trocar a senha no primeiro acesso** (Meu perfil).

   **Ambiente de apresentação com dados fictícios** (para mostrar à cliente antes de usar de
   verdade)? Em vez do seed acima, rode a demonstração — ela **apaga tudo** e gera 12 meses de
   operação simulada, por isso exige a confirmação:
   ```bash
   DATABASE_URL="$DIRECT" DIRECT_URL="$DIRECT" DEMO_SEED_CONFIRM=apagar-tudo pnpm db:seed:demo
   ```
   Antes de começar o uso real: crie um projeto Supabase novo (ou rode `prisma migrate reset`
   nele) e faça o passo 3 normal.

---

## 2. API — Render

1. **New → Blueprint** → conecte o GitHub → escolha `opedrogouveia/locamania` → **Apply**.
   O Render lê o [`render.yaml`](../render.yaml) e cria o serviço `locamania-api` (Docker, free).
2. Ele pede as variáveis marcadas como secretas. Preencha:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | a URL do **Transaction pooler** (6543, com `?pgbouncer=true&connection_limit=1`) |
   | `DIRECT_URL` | a URL do **Session pooler** (5432) |
   | `JOBS_SECRET` | `openssl rand -hex 32` — **anote**, vai no GitHub também (passo 4) |
   | `CORS_ORIGIN` | o endereço do site na Vercel, sem barra no fim — ex.: `https://locamania.vercel.app` |
   | `APP_PUBLIC_URL` | o mesmo endereço do site (vai nos links dos e-mails) |
   | `MAIL_PASSWORD` | a API key da Resend (passo 5) — pode deixar vazio por enquanto |
   | `MAIL_FROM` | `Locamania <nao-responda@seudominio.com.br>` (domínio verificado na Resend) |
   | `SENTRY_DSN` | vazio (opcional, monitoramento de erros) |

   `JWT_SECRET` e `PAYMENT_WEBHOOK_SECRET` o Render gera sozinho. Ainda não sabe o endereço da
   Vercel? Use `https://locamania.vercel.app` e ajuste depois do passo 3.

3. Aguarde o primeiro build (~5 min). Teste: `https://locamania-api.onrender.com/health` → `{"status":"ok"...}`.
   Documentação da API: `/docs`.

> A API **recusa subir** em produção com segredo fraco/de exemplo ou `localhost` no CORS — é de
> propósito. Se o deploy falhar, veja *Logs* no Render: a mensagem diz qual variável corrigir.

> **Plano free**: a API dorme após 15 min sem uso; o primeiro acesso depois disso demora ~50 s.
> Para a cliente não sentir, o plano *Starter* (US$ 7/mês) mantém sempre ligada — mudar em
> *Settings → Instance type*, sem mexer em nada mais.

---

## 3. Site — Vercel

1. **Add New → Project** → importe `opedrogouveia/locamania`.
2. Configure:
   - *Root Directory*: **`frontend`**
   - *Framework Preset*: Next.js (detectado). Install/Build já vêm do [`frontend/vercel.json`](../frontend/vercel.json) — não altere.
   - *Environment Variables*:

     | Variável | Valor |
     |---|---|
     | `NEXT_PUBLIC_API_URL` | `https://locamania-api.onrender.com` (sem barra no fim) |
     | `NEXT_PUBLIC_APP_NAME` | `Locamania` |
3. **Deploy**. Anote o endereço (ex.: `https://locamania.vercel.app`). Se for diferente do que pôs
   no Render, atualize `CORS_ORIGIN` e `APP_PUBLIC_URL` lá (*Environment* → *Save* → redeploy).
4. Domínio próprio (opcional): Vercel → *Settings → Domains* (ex.: `app.locamania.com.br`); depois
   atualize `CORS_ORIGIN`/`APP_PUBLIC_URL` no Render.

---

## 4. Rotinas diárias e backup — GitHub Actions

No GitHub: repositório → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|---|---|
| `API_URL` | `https://locamania-api.onrender.com` (sem barra) |
| `JOBS_SECRET` | o mesmo do Render |
| `DATABASE_URL_BACKUP` | a URL do **Session pooler** (5432) |

Teste agora: aba **Actions** → *Rotinas diárias* → **Run workflow**; depois *Backup do banco* →
**Run workflow**. Os dois devem ficar verdes. A partir daí rodam sozinhos:
- **08:00** (Brasília): atrasos, lembretes de pagamento (3 dias, 1 dia, no dia), escalonamento de
  inadimplência, manutenção, documentos, contratos terminando, motos paradas.
- **03:00**: backup do banco (guardado 30 dias como artefato do workflow).

> Bônus: essas execuções diárias também evitam que o Supabase free **pause o projeto** por falta de
> uso (ele pausa após 7 dias sem acesso).

---

## 5. E-mail — Resend (opcional, recomendado)

Sem e-mail o sistema funciona (avisos aparecem no app e no painel, e há o link do WhatsApp), mas
convite de acesso, recuperação de senha e recibos por e-mail precisam dele.

1. <https://resend.com> → **Domains → Add domain** → o domínio da Locamania → crie no DNS os
   registros que ela mostrar (SPF/DKIM). Aguarde "Verified".
2. **API Keys → Create** (permissão *Sending access*) → copie.
3. No Render: `MAIL_PASSWORD` = a key; `MAIL_FROM` = `Locamania <nao-responda@dominio-verificado>`.
   (`MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER` já vêm no blueprint.)

Sem domínio ainda? `MAIL_FROM=Locamania <onboarding@resend.dev>` funciona só para o e-mail da
própria conta Resend — serve para testar.

---

## 6. Conferir

```bash
API=https://locamania-api.onrender.com OWNER_EMAIL=email-da-proprietaria@exemplo.com \
  PASSWORD='senha-provisoria' node scripts/smoke.mjs
```
Só leitura (seguro em produção): saúde, login, permissões e isolamento do app do cliente. Contas que
não existirem são puladas. **Não** use `--write` em produção (cria cliente e contrato de teste).

Depois, pelo navegador:
- [ ] Entrar com a proprietária → painel abre.
- [ ] Configurações → Empresa: preencher dados, chave PIX, horário de atendimento.
- [ ] Configurações → Usuários: criar as contas da equipe.
- [ ] Cadastrar um cliente real de teste → *Enviar acesso ao app* → abrir o link no celular → criar
      senha → entrar com o CPF. No celular: *Compartilhar → Adicionar à tela de início* instala o app.

---

## Atualizar o sistema depois

- **Código**: `git push` na `main` → Render e Vercel publicam sozinhos (~5 min).
- **Mudança no banco** (nova migration em `backend/prisma/migrations`): **antes** do push, aplique
  no Supabase:
  ```bash
  cd backend && DATABASE_URL="$DIRECT" DIRECT_URL="$DIRECT" npx prisma migrate deploy
  ```
  (Migrations são aditivas; a versão em produção continua funcionando até o novo deploy.)

## Integrações (quando houver contrato com o fornecedor)

| Integração | Hoje | Para ligar de verdade |
|---|---|---|
| Pagamento PIX | `PAYMENT_GATEWAY=sandbox` — PIX de teste, confirmado por webhook assinado | escolher o gateway (Asaas, Mercado Pago, Efí…) → implementar o adaptador da porta `PaymentGateway` (um arquivo) → chaves no Render |
| WhatsApp | `WHATSAPP_PROVIDER=disabled` — links `wa.me` com a mensagem pronta | conta na WhatsApp Business Platform (Meta) + adaptador da porta `WhatsAppChannel` |
| Rastreador | `TRACKER_PROVIDER=sandbox` — posições simuladas | escolher o fornecedor do equipamento → adaptador da porta `TrackerProvider` |
| Assinatura eletrônica | aceite no app (senha + IP + navegador + hash do texto) e presencial | se quiser certificado ICP/serviço (Clicksign, ZapSign…), adaptador novo |

Ver [`RUNBOOK.md`](RUNBOOK.md) para operação, backup/restauração e incidentes.
