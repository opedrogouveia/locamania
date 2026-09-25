# Plano do MVP — Locamania

> **Documento de execução.** Tudo o que o MVP precisa ter, na ordem em que será construído, com o
> critério de "pronto" de cada etapa. Os checkboxes são o **rastreador de progresso**: marcar ao
> concluir e commitar junto.
>
> Fonte dos requisitos: [`REQUISITOS_CLIENTE.txt`](REQUISITOS_CLIENTE.txt) (47 seções, citadas como
> §N). Padrão de engenharia herdado do SafeKeep: [`HERANCA_SAFEKEEP.md`](HERANCA_SAFEKEEP.md).
>
> Criado em 24/09/2026.

## Como retomar se a sessão for interrompida

1. Ler este arquivo e achar o **primeiro checkbox vazio** — é o próximo passo.
2. `git log --oneline | head -20` para ver o último bloco commitado.
3. `git status` para ver trabalho não commitado (terminar ou descartar conscientemente).
4. Ler a seção "Estado atual" de [`HANDOFF.md`](HANDOFF.md).
5. Ambiente: `docker compose up -d` + `pnpm dev` (ver §3.4). Checar antes se já está no ar.

---

## 1. Escopo

### 1.1 O que é

Sistema de gestão de uma locadora de **motos** (Locamania) com duas faces sobre o mesmo banco e a
mesma API:

- **Painel administrativo** — a proprietária e a equipe operam tudo (§2–§14, §20–§32, §42).
- **App do cliente** — o locatário acompanha só o próprio aluguel (§9, §13, §15–§17, §38, §46).

Pedido do Pedro (24/09/2026): **web 100% responsiva** (nada de app nativo agora), com a área do
cliente pensada primeiro para o celular e o painel impecável tanto no PC quanto no celular — a
proprietária também usa muito pelo telefone. Instalável na tela inicial (PWA).

### 1.2 O que entra no MVP (tudo o que o documento pede)

| Área | Entrega | § |
|---|---|---|
| Painel administrativo completo | dashboard, cadastros, fichas, listas, filtros, pesquisa, configurações | 2–8, 20–32, 42 |
| App do cliente | início, moto, pagamentos (PIX), contrato (aceite), manutenção, avisos, perfil, suporte | 9, 13, 15–17 |
| Backend/API | REST + Swagger, Clean Architecture, validação, erros, jobs agendados | 33, 34, 44 |
| Banco de dados | PostgreSQL (Supabase em produção), migrations, seed realista | 33, 36 |
| Contratos | criação, modelo editável, PDF, envio, assinatura registrada, entrega, aditivos, encerramento | 10, 39 |
| Pagamentos e inadimplência | cronograma automático, baixa manual, PIX via gateway (sandbox), webhook, multa/juros, atraso automático, bloqueio/cobrança configuráveis | 11–14, 40 |
| Manutenção | tipos, planos por km/data/intervalo, registros, alertas, página por status, visão do cliente | 7–9, 41 |
| Notificações | in-app (admin e cliente), e-mail, WhatsApp (adaptador + link oficial click-to-chat), avisos da Locamania, lembretes configuráveis | 12, 18, 19 |
| Permissões | Proprietário, Administrador, Financeiro, Funcionário — matriz editável; cliente isolado | 28, 46 |
| Histórico/auditoria | log imutável automático + tela de histórico em linguagem natural + linha do tempo por ficha | 6, 30 |
| Documentos e fotos | anexos por cliente/moto/contrato/manutenção/ocorrência/devolução, validade e alertas | 20, 21, 24 |
| Ocorrências e multas | cadastro, anexos, cobrança do cliente | 22 |
| Devolução | vistoria, km final, fotos, avarias, pendências, caução, destino da moto | 23 |
| Financeiro e relatórios | recebimentos, pendências, inadimplência, receitas/despesas, resultado; relatórios PDF/Excel | 25, 26 |
| Rastreamento | preparado: adaptador por fornecedor, posição/última comunicação (simulado), bloqueio com confirmação, motivo e auditoria | 31, 32 |
| Segurança e LGPD | argon2, JWT com versão de sessão, recuperação de senha, rate limit, isolamento do cliente, aviso de privacidade | 29, 46 |
| Offline | aviso "Sem conexão com a internet", nenhuma escrita sem confirmação do servidor | 35 |
| Deploy e configuração | Dockerfile, render.yaml, vercel.json, CI, backup e agendador no GitHub Actions, guia campo a campo | 36, 44 |
| Suporte pós-entrega | manual da administradora, runbook de operação, backup/restauração, monitoramento | — |

### 1.3 O que fica simulado (depende de conta ou contrato de terceiro)

| Item | No MVP | Para virar real |
|---|---|---|
| Gateway PIX | provedor **sandbox**: gera PIX de teste, confirma por **webhook assinado** (HMAC) com idempotência. Botão "Simular pagamento" só existe em sandbox | escolher gateway (Asaas, Mercado Pago, Efí…), implementar o adaptador, chaves no ambiente |
| WhatsApp API oficial | adaptador `WhatsAppChannel` registrando "não configurado" + **link click-to-chat** (`wa.me`) com a mensagem pronta em cada aviso/cobrança | conta WhatsApp Business Platform aprovada pela Meta + templates aprovados |
| Assinatura eletrônica com provedor | PDF + **registro de assinatura**: upload do contrato assinado em papel **ou** aceite eletrônico no app (data, IP, user-agent, hash SHA-256 do PDF) | provedor (ZapSign, Clicksign, D4Sign) via adaptador |
| Rastreador / bloqueio | adaptador `TrackerProvider` com capacidades; provedor **sandbox** com posições simuladas; comando de bloqueio registrado como "simulado" | API do fornecedor escolhido; bloqueio só pelas regras do equipamento |
| E-mail em produção | Mailpit em dev; SMTP (Resend) por variável | conta Resend + domínio verificado |
| Push no celular | fora do MVP (backlog): avisos in-app com contador + e-mail | web push (VAPID) |

### 1.4 Fora do MVP (backlog registrado)

App nativo (a PWA cobre), SMS, contabilidade, emissão fiscal, colunas configuráveis por usuário,
histórico de localização completo, anonimização LGPD automatizada, multiempresa.

---

## 2. Decisões assumidas (Pedro pode mudar amanhã)

| # | Decisão | Motivo |
|---|---|---|
| D1 | UI em **pt-BR**, moeda **BRL**, fuso **America/Sao_Paulo**, datas `dd/mm/aaaa` | cliente brasileiro |
| D2 | Código, dados e rotas **100% em inglês**; comentários e docs em **PT-BR** | padrão SafeKeep |
| D3 | **Mesma stack do SafeKeep** (Node 24, pnpm 11, Turborepo, NestJS 11, Prisma 6.19, Postgres 17, Next 16, React 19, Tailwind 4, TanStack Query 5) | pedido do Pedro; Prisma 6 porque a fundação de auditoria é provada nele |
| D4 | Perfis: `OWNER` (Proprietário), `ADMIN`, `FINANCE`, `STAFF` + **cliente** com autenticação separada | §28 |
| D5 | **Login único** (`/login`): e-mail → equipe; CPF → cliente | uma URL para mandar a todos |
| D6 | Primeiro acesso do cliente por **link de convite** (e-mail e/ou WhatsApp), que define a senha | §39 etapa 11 |
| D7 | Cobrança **antecipada**: 1ª parcela no início do contrato; última proporcional aos dias | prática de locação; configurável por contrato (1º vencimento) |
| D8 | Tolerância, multa (%) e juros (% ao mês, pro rata dia) configuráveis; dentro da tolerância não há encargo | §14 |
| D9 | **Status derivados na leitura** (cobrança "próxima do vencimento", situação da manutenção) + **job idempotente** para persistir atraso e disparar avisos | lição do SafeKeep: alerta calculado não envelhece |
| D10 | Agendador: `@nestjs/schedule` **e** GitHub Actions chamando `/jobs/run` com segredo | o Render free hiberna e o cron interno não roda dormindo |
| D11 | Arquivos (documentos/fotos) como bytes no banco, imagem reduzida no navegador, limite 8 MB | disco do Render é efêmero; migra para storage depois |
| D12 | Cidade/endereço preenchidos pelo **CEP (ViaCEP)**; UF como lista fechada | evita digitação livre sem tabela de 5.570 municípios |
| D13 | Marca/modelo de moto, tipos de documento, categorias de despesa: **CatalogItem**; tipos de manutenção: tabela própria (têm intervalo padrão) | regra "nada de texto livre" |
| D14 | Valor financeiro **não sai da API** para quem não tem `payments.view`/`finance.view` | padrão SafeKeep |
| D15 | Portas locais distintas do SafeKeep: web **3200**, API **3201**, Postgres **5433**, Mailpit **1026/8026** | os dois projetos convivem na máquina |
| D16 | Placeholders do modelo de contrato em português (`{{cliente.nome}}`) | quem edita o modelo é a administradora |
| D17 | Identidade visual neutra (azul de interface + neutros cinza) até chegar o logo; troca num lugar só | sem marca ainda |
| D18 | Dados de demonstração: cidade de São Paulo/SP, 12 meses de operação | só demo; fácil trocar |

---

## 3. Arquitetura

### 3.1 Monorepo

```
locamania/
  backend/            NestJS (Clean Architecture) + prisma/ + Dockerfile
  frontend/           Next.js — painel (/admin) e app do cliente (/app), sem Docker
  packages/shared/    contratos, enums, permissões, regras puras compartilhadas, máscaras, datas
  docs/  specs/  scripts/  .github/workflows/  .claude/
```

### 3.2 Autenticação e autorização

- JWT próprio com `typ: 'staff' | 'customer'`, `sub`, `ver` (versão de sessão). A estratégia confere
  a cada requisição (com cache curto) que a conta está ativa e a versão bate — trocar senha ou
  "encerrar sessões" invalida os tokens antigos.
- Guard global de autenticação + **guard de ator**: rota sem `@CustomerRoute()` **recusa token de
  cliente** (padrão seguro). Rotas do cliente vivem em `/portal/*` e **só usam o id do token**,
  nunca um id vindo da URL.
- Equipe: `@RequirePermissions('x.y')` avaliado contra a matriz `RolePermission` (banco, editável
  pelo Proprietário, com cache). `OWNER` sempre tem tudo.
- Rate limit em login, recuperação de senha e webhook.

### 3.3 Permissões (padrão inicial — §28)

| Permissão | OWNER | ADMIN | FINANCE | STAFF |
|---|:-:|:-:|:-:|:-:|
| `dashboard.view` | ✔ | ✔ | ✔ | ✔ |
| `customers.view` / `customers.manage` | ✔/✔ | ✔/✔ | ✔/– | ✔/✔ |
| `motorcycles.view` / `motorcycles.manage` | ✔/✔ | ✔/✔ | ✔/– | ✔/✔ |
| `contracts.view` / `contracts.manage` | ✔/✔ | ✔/✔ | ✔/– | ✔/– |
| `payments.view` / `payments.manage` | ✔/✔ | ✔/✔ | ✔/✔ | –/– |
| `finance.view` / `finance.manage` | ✔/✔ | ✔/✔ | ✔/✔ | –/– |
| `maintenance.view` / `maintenance.manage` | ✔/✔ | ✔/✔ | ✔/– | ✔/✔ |
| `occurrences.view` / `occurrences.manage` | ✔/✔ | ✔/✔ | ✔/– | ✔/✔ |
| `documents.view` / `documents.manage` | ✔/✔ | ✔/✔ | ✔/– | ✔/✔ |
| `reports.view` / `reports.export` | ✔/✔ | ✔/✔ | ✔/✔ | –/– |
| `notifications.send` (avisos aos clientes) | ✔ | ✔ | – | – |
| `support.manage` | ✔ | ✔ | – | ✔ |
| `tracking.view` / `tracking.command` | ✔/✔ | ✔/✔ | –/– | ✔/– |
| `audit.view` | ✔ | ✔ | – | – |
| `settings.manage` | ✔ | ✔ | – | – |
| `users.manage` (usuários e permissões) | ✔ | – | – | – |

### 3.4 Ambiente local

`docker compose up -d` (Postgres 5433 + Mailpit 8026) → `pnpm dev` (API 3201, web 3200, shared em
watch). Swagger em `:3201/docs`. Contas de demonstração no `README.md`.

---

## 4. Modelo de domínio

### 4.1 Enums

| Enum | Valores |
|---|---|
| `StaffRole` | OWNER, ADMIN, FINANCE, STAFF |
| `CustomerStatus` | ACTIVE, INACTIVE, OVERDUE, CONTRACT_ENDED, BLOCKED |
| `MotorcycleStatus` | AVAILABLE, RENTED, RESERVED, MAINTENANCE, BLOCKED, INACTIVE |
| `ContractStatus` | DRAFT, ACTIVE, ENDED, CANCELLED |
| `SignatureStatus` / `SignatureMethod` | PENDING, SIGNED / IN_PERSON, ELECTRONIC_ACCEPTANCE, PROVIDER |
| `PaymentPeriodicity` | WEEKLY, BIWEEKLY, MONTHLY |
| `ChargeKind` | RENT, DEPOSIT, FINE, DAMAGE, OTHER |
| `ChargeStatus` (gravado) | PENDING, PAID, OVERDUE, CANCELLED |
| `ChargeDisplayStatus` (derivado — §11) | PAID, UPCOMING, DUE_SOON, OVERDUE, CANCELLED |
| `PaymentMethod` | PIX, CASH, CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, BOLETO, OTHER |
| `MaintenanceStatus` | SCHEDULED, IN_PROGRESS, DONE, CANCELLED |
| `MaintenanceDueStatus` (derivado) | OK, DUE_SOON, OVERDUE |
| `OccurrenceType` | TRAFFIC_FINE, ACCIDENT, DAMAGE, THEFT, MECHANICAL_ISSUE, OTHER |
| `OccurrenceStatus` | OPEN, IN_PROGRESS, RESOLVED, CANCELLED |
| `OdometerSource` | CONTRACT_START, RETURN, MAINTENANCE, MANUAL, CUSTOMER, TRACKER |
| `ReturnCondition` | GOOD, FAIR, DAMAGED |
| `DepositOutcome` | REFUNDED, RETAINED, PARTIALLY_RETAINED, NONE |
| `DocumentOwnerType` | CUSTOMER, MOTORCYCLE, CONTRACT, MAINTENANCE, OCCURRENCE, CHARGE, RETURN, FINANCIAL_ENTRY |
| `FinancialEntryType` | INCOME, EXPENSE |
| `NotificationRecipientType` | USER, CUSTOMER |
| `NotificationSeverity` | INFO, SUCCESS, WARNING, DANGER |
| `NotificationChannel` / `DeliveryStatus` | IN_APP, EMAIL, WHATSAPP / SENT, FAILED, SKIPPED |
| `SupportMessageStatus` | OPEN, ANSWERED, CLOSED |
| `TrackerCommandType` / `TrackerCommandStatus` | BLOCK, UNBLOCK / REQUESTED, SENT, CONFIRMED, FAILED, SIMULATED |
| `AuditAction` | CREATE, UPDATE, DELETE, LOGIN, LOGOUT, STATUS_CHANGE, EXPORT, COMMAND |
| `ActorType` | USER, CUSTOMER, SYSTEM |

### 4.2 Entidades

| Model | Campos principais |
|---|---|
| `User` | name, email, passwordHash, role, active, phone, sessionVersion, lastLoginAt, deletedAt |
| `RolePermission` | role (único), permissions `String[]` |
| `AuthToken` | tokenHash, purpose (PASSWORD_RESET, CUSTOMER_INVITE), userId?/customerId?, expiresAt, usedAt |
| `Customer` | number (seq), name, cpf (único), rg, birthDate, phone, whatsapp, email, postalCode, street, streetNumber, complement, district, city, state, cnhNumber, cnhCategory, cnhExpiresAt, status (efetivo), manualStatus (BLOCKED/INACTIVE), blockedReason, inCollection/collectionSince, notes, portalEnabled, passwordHash, sessionVersion, portalLastLoginAt, privacyAcceptedAt, deletedAt |
| `Motorcycle` | brandCode, modelCode, manufactureYear, modelYear, color, plate (único), renavam, chassis, currentKm, acquiredAt, purchasePrice, status, statusReason, hasTracker, trackerProvider, trackerDeviceId, notes, deletedAt |
| `OdometerReading` | motorcycleId, km, readAt, source, userId?, customerId?, contractId?, notes |
| `Contract` | number (`LOC-AAAA-NNNN`), customerId, motorcycleId, status, startDate, endDate, firstDueDate, periodicity, rentAmount, depositAmount, initialKm, rules, notes, renderedText (congelado ao gerar), documentHash, signatureStatus, signatureMethod, signedAt, signatureIp, signatureUserAgent, sentAt, deliveredAt, endedAt, cancelledAt, cancelReason, createdById |
| `Charge` | number, customerId, contractId?, motorcycleId?, occurrenceId?, kind, sequence, description, periodStart/periodEnd, dueDate, amount, status, paidAt, paidAmount, fineAmount, interestAmount, discountAmount, method, notes, registeredById, gateway (provider, chargeId, pixCode, expiresAt) |
| `GatewayEvent` | provider, eventId (único — idempotência), type, payload, signatureValid, chargeId?, processedAt |
| `MaintenanceType` | code, name, defaultIntervalKm, defaultIntervalDays, active, sortOrder |
| `MaintenancePlan` | motorcycleId, typeId (único por moto), intervalKm, intervalDays, lastDoneKm, lastDoneAt, nextDueKm, nextDueDate, active |
| `MaintenanceRecord` | motorcycleId, status, types (N:N), scheduledFor, startedAt, completedAt, km, workshop, parts, cost, notes, createdById |
| `Occurrence` | type, occurredAt, motorcycleId?, customerId?, contractId?, description, amount, status, fineNumber, fineDueDate, chargeId?, notes, createdById |
| `ReturnInspection` | contractId (único), returnedAt, finalKm, condition, fuelLevel, damages, pendingItems, nextMotorcycleStatus, depositOutcome, depositRetainedAmount, notes, createdById |
| `Document` | ownerType, ownerId, typeCode, title, fileName, mimeType, sizeBytes, data (bytes), expiresAt, visibleToCustomer, uploadedById?/uploadedByCustomerId?, deletedAt |
| `FinancialEntry` | type, categoryCode, description, amount, date, motorcycleId?, customerId?, supplier, method, createdById, deletedAt |
| `Notification` | recipientType, userId?/customerId?, type, title, body, severity, link, entityType, entityId, dedupeKey, readAt |
| `NotificationDelivery` | notificationId, channel, status, detail |
| `Announcement` | title, body, audience, recipientsCount, createdById |
| `SupportMessage` | customerId, subject, body, status, answer, answeredById, answeredAt |
| `TrackerPosition` | motorcycleId, lat, lng, speedKmh, recordedAt |
| `TrackerCommand` | motorcycleId, type, reason, status, requestedById, providerResponse |
| `CatalogItem` | group, code, label, sortOrder, active, userCreated |
| `AppParameter` | key, value, valueType, group, label, description |
| `CompanySettings` | tradeName, legalName, cnpj, phone, whatsapp, email, endereço, pixKey, supportHours, contractTemplate |
| `JobRun` | name, startedAt, finishedAt, status, summary |
| `AuditLog` | occurredAt, actorType, actorId, actorName, action, entityType, entityId, changes, metadata, correlationId |

### 4.3 Regras de negócio (funções puras com teste, em `packages/shared/src/rules/`)

1. **Cronograma de cobrança** — `buildRentSchedule({ startDate, endDate, firstDueDate, periodicity, amount })`:
   parcelas a cada 7/14 dias ou no mesmo dia do mês (ajustado ao último dia); cada parcela cobre o
   período que começa no vencimento; a última é **proporcional aos dias** se passar do término.
2. **Encargos** — `computeLateFees({ amount, dueDate, today, graceDays, finePercent, monthlyInterestPercent })`:
   dentro da tolerância não há encargo; depois, multa única + juros pro rata dia desde o vencimento.
3. **Situação da cobrança** — `chargeDisplayStatus(charge, today, { graceDays, dueSoonDays })`.
4. **Situação da manutenção** — `maintenanceDueStatus(plan, currentKm, today, { warnKm, warnDays })`
   → OK/DUE_SOON/OVERDUE + km e dias restantes; `nextDueAfter(record, plan)` recalcula o intervalo.
5. **Situação do cliente** — `resolveCustomerStatus({ manualStatus, hasActiveContract, hasOverdue, hadContract })`.
6. **Lembretes** — `reminderOffsetsDue(dueDate, today, offsets[])` → quais avisos disparar hoje.
7. **Validações** — CPF (dígitos verificadores), placa (antiga e Mercosul), CEP, telefone.
8. **Transições** — moto só vai para RENTED por contrato; contrato DRAFT → ACTIVE exige assinatura
   registrada e moto disponível/reservada; encerrar exige devolução.

### 4.4 Jobs (idempotentes, com chave de deduplicação)

`markOverdue` → `paymentReminders` → `delinquencyEscalation` (bloqueio/cobrança após N dias) →
`maintenanceAlerts` → `documentAlerts` (docs e CNH) → `contractEndingAlerts` → `idleMotorcycles`.
Rodam às 08:00 (America/Sao_Paulo) por `@nestjs/schedule`, por `POST /jobs/run` (segredo, chamado
pelo GitHub Actions) e manualmente em Configurações › Sistema. Cada execução grava `JobRun`.

---

## 5. Telas

### 5.1 Painel (`/admin`)

| Tela | Conteúdo |
|---|---|
| Dashboard | indicadores de §2.1, alertas coloridos, receita recente (se `finance.view`), ações rápidas |
| Clientes | lista (busca, filtros por situação) · cadastro · **ficha completa** (§4): resumo, contratos, pagamentos, documentos, ocorrências/multas, histórico; ações: WhatsApp, novo aluguel, enviar acesso, bloquear |
| Motos | lista (situação, placa) · cadastro · ficha: resumo, aluguéis, manutenção (planos + registros), quilometragem, documentos, ocorrências, gastos, rastreamento, histórico |
| Contratos | lista · **novo aluguel** (cliente → moto → condições → revisão, com prévia do cronograma) · detalhe: cronograma, PDF (ver/baixar/imprimir/enviar), assinatura, entrega, reajuste/prorrogação, devolução, histórico |
| Pagamentos | abas A vencer / Próximos / Em atraso / Pagos / Cancelados, período, registrar pagamento (forma, data, encargos sugeridos, comprovante), cobrança avulsa |
| Inadimplência | clientes em atraso, dias, total devido, ações (cobrar pelo WhatsApp, bloquear, encaminhar para cobrança) |
| Manutenção | abas Próximas / Vencidas / Em andamento / Realizadas, novo registro, planos |
| Ocorrências e multas | lista, cadastro, anexos, cobrar do cliente |
| Documentos | vencendo / vencidos / todos (frota e clientes) |
| Financeiro | período (hoje/semana/mês/personalizado), recebido, pendente, atraso, despesas, resultado, receita por moto e por cliente, lançamentos |
| Relatórios | frota, clientes, financeiro, manutenção, aluguéis — exportar PDF e Excel |
| Notificações | central + sino na barra; enviar aviso aos clientes |
| Suporte | mensagens dos clientes, responder |
| Rastreamento | motos com rastreador, última comunicação, posição, bloqueio seguro |
| Histórico | auditoria em linguagem natural, filtros por usuário/entidade/ação/período |
| Configurações | empresa, pagamentos e avisos, inadimplência, manutenção, documentos, contrato (modelo), notificações, formas de pagamento, categorias, usuários, permissões, integrações, sistema (jobs, backup) |
| Pesquisa global | barra + atalho Ctrl+K: nome, CPF, telefone, placa, modelo, nº do contrato; placa exata abre a ficha |

### 5.2 App do cliente (`/app`)

Barra inferior no celular (Início, Pagamentos, Moto, Avisos, Mais); barra superior no desktop.

| Tela | Conteúdo |
|---|---|
| Início | "Olá, João 👋", moto, aluguel, próximo pagamento + **PAGAR**, próxima manutenção, situação, avisos recentes |
| Pagamentos | próximo, histórico, status, comprovantes; **PIX** (QR + copia e cola + acompanhamento automático) |
| Minha moto | dados básicos, quilometragem, **informar km**, próxima manutenção, documentos liberados (CRLV) |
| Meu contrato | resumo, PDF, **aceite eletrônico** quando pendente |
| Manutenção | próxima manutenção, avisos ("Sua moto precisa passar por manutenção…") — sem custos |
| Avisos | notificações, marcar como lidas |
| Perfil | dados básicos, trocar senha, sair |
| Suporte | WhatsApp/telefone/e-mail da Locamania, horário, enviar mensagem e ver respostas |

---

## 6. Etapas de execução

> Cada etapa termina com: typecheck + testes verdes, verificação rodando (HTTP e/ou tela), commit
> e checkbox marcado. Telas conferidas em **390 px (celular) e 1440 px (desktop)**.

### Etapa 0 — Fundação e harness
- [ ] 0.1 Git + remoto + `.gitattributes`; requisitos renomeados para `docs/REQUISITOS_CLIENTE.txt`
- [ ] 0.2 Camada de contexto: `CLAUDE.md` (raiz, backend, **frontend**), `VERSOES.md`, `README.md`, `docs/HANDOFF.md`, `docs/ARQUITETURA.md`, `docs/DESIGN_SYSTEM.md`, `docs/GLOSSARIO.md`, `docs/decisoes-e-perguntas.md`, `docs/BACKLOG.md`, `docs/templates/new-module.md` (fiel ao código), `specs/`
- [ ] 0.3 Harness: `.claude/settings.json` (permissões de rotina), `.claude/skills/new-module/`, `.claude/launch.json`
- [ ] 0.4 Monorepo: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, ESLint, Prettier, `.npmrc`, `.gitignore`, `.dockerignore`, `.env.example`, `docker-compose.yml`
- [ ] 0.5 `packages/shared`: enums, permissões, contratos base, regras puras (4.3) **com testes**, máscaras, datas (fuso), dinheiro
- [ ] 0.6 Backend: fundação copiada/adaptada do SafeKeep (config, CLS, Prisma + auditoria, erros, auth equipe + cliente, guard de ator, permissões, segurança, health, mail, Sentry, rate limit, PDF), **schema completo** (4.2), migration inicial, seed mínima, Jest
- [ ] 0.7 Frontend: Next, tokens, primitivos, shells responsivos (painel e cliente), login único, recuperação de senha, primeiro acesso, cliente de API, guardas, PWA (manifest + ícones), aviso offline
- [ ] 0.8 Verificação: `pnpm typecheck lint test build`; login com cada perfil e com cliente; commit

### Etapa 1 — Cadastros e configurações
- [ ] 1.1 Usuários (CRUD, travas do último proprietário) + matriz de permissões editável
- [ ] 1.2 Configurações: empresa, parâmetros (pagamento, avisos, inadimplência, manutenção, documentos, contrato ocioso), catálogos, tipos de manutenção, formas de pagamento, modelo de contrato
- [ ] 1.3 Clientes: CRUD, CPF/CEP/telefone validados, ViaCEP, CNH, situação, convite ao app
- [ ] 1.4 Motos: CRUD, situação com motivo, quilometragem (leituras), rastreador
- [ ] 1.5 Pesquisa global (API + barra + Ctrl+K)

### Etapa 2 — Contratos
- [ ] 2.1 Novo aluguel (assistente) com prévia do cronograma; moto fica RESERVADA
- [ ] 2.2 Modelo de contrato → texto congelado → PDF (ver/baixar/imprimir), envio ao cliente
- [ ] 2.3 Assinatura: presencial (upload do assinado) e aceite eletrônico no app (IP, UA, hash)
- [ ] 2.4 Entrega: km inicial + fotos → moto ALUGADA, cronograma e caução gerados, cliente ATIVO, convite
- [ ] 2.5 Reajuste de valor (parcelas futuras), prorrogação, cancelamento

### Etapa 3 — Pagamentos e inadimplência
- [ ] 3.1 Lista de cobranças com situação derivada, filtros e totais
- [ ] 3.2 Registrar pagamento (encargos sugeridos, comprovante), estorno, cobrança avulsa
- [ ] 3.3 Gateway: porta + provedor sandbox (PIX, QR, webhook HMAC, idempotência)
- [ ] 3.4 Jobs: atraso, lembretes, escalonamento (bloqueio/cobrança), recalculo da situação do cliente
- [ ] 3.5 Tela de inadimplência + link de cobrança pelo WhatsApp

### Etapa 4 — Manutenção
- [ ] 4.1 Planos por moto (km/data/intervalo) criados a partir dos tipos
- [ ] 4.2 Registros (agendada, em andamento, realizada), recálculo do próximo intervalo, moto EM MANUTENÇÃO
- [ ] 4.3 Página por status + alertas + visão do cliente

### Etapa 5 — Documentos, fotos, ocorrências, devolução
- [ ] 5.1 Documentos/fotos (upload com redução, validade, visível ao cliente) em todas as fichas
- [ ] 5.2 Ocorrências e multas + cobrar do cliente
- [ ] 5.3 Devolução: vistoria, pendências, caução, destino da moto, encerramento do contrato

### Etapa 6 — Notificações e dashboard
- [ ] 6.1 Serviço de notificação (in-app, e-mail, WhatsApp adaptador) com deduplicação e registro de entrega
- [ ] 6.2 Sino + central (painel), avisos aos clientes, suporte
- [ ] 6.3 Dashboard com indicadores e alertas
- [ ] 6.4 Jobs de manutenção, documentos, contratos e motos paradas; `/jobs/run`

### Etapa 7 — App do cliente
- [ ] 7.1 API `/portal/*` (só dados do próprio cliente) + testes de isolamento
- [ ] 7.2 Telas: início, pagamentos + PIX, moto + informar km, contrato + aceite, manutenção, avisos, perfil, suporte

### Etapa 8 — Financeiro, relatórios, histórico
- [ ] 8.1 Lançamentos (receitas/despesas) + painel financeiro por período
- [ ] 8.2 Relatórios (5) com exportação PDF e Excel (auditada como EXPORT)
- [ ] 8.3 Histórico/auditoria em linguagem natural + linha do tempo nas fichas

### Etapa 9 — Rastreamento
- [ ] 9.1 Porta `TrackerProvider` (capacidades) + provedor sandbox; posição e última comunicação na ficha
- [ ] 9.2 Bloqueio: dupla confirmação, motivo, registro, só se o provedor suportar

### Etapa 10 — Dados de demonstração
- [ ] 10.1 Seed de 12 meses: ~40 motos, ~130 clientes, contratos ativos e encerrados, pagamentos com atrasos realistas, manutenções, ocorrências, multas, despesas, documentos, notificações, mensagens e histórico de auditoria

### Etapa 11 — Qualidade
- [ ] 11.1 Testes de regra (shared + domínio) e de isolamento do cliente
- [ ] 11.2 `scripts/smoke.sh`: login de cada perfil, permissões, fluxo de aluguel, PIX sandbox
- [ ] 11.3 Revisão visual (Chromium headless) em 390 px e 1440 px de todas as telas

### Etapa 12 — Deploy e suporte
- [ ] 12.1 `backend/Dockerfile`, `render.yaml`, `frontend/vercel.json`
- [ ] 12.2 GitHub Actions: CI (typecheck/test), backup diário, agendador dos jobs
- [ ] 12.3 `docs/DEPLOY.md` campo a campo (Supabase, Render, Vercel, Resend)
- [ ] 12.4 `docs/MANUAL_ADMIN.md`, `docs/RUNBOOK.md` (operação, backup/restauração, incidentes)

### Etapa 13 — Entrega
- [ ] 13.1 Stack rodando na máquina do Pedro com os dados de demonstração
- [ ] 13.2 `HANDOFF.md` final, perguntas para a cliente, resumo da noite

---

## 7. Critério de "MVP pronto"

- O fluxo de §47 inteiro funciona pela tela: cadastrar cliente → moto → contrato → assinatura →
  entrega → cobranças → PIX sandbox confirmado por webhook → atraso automático → alertas →
  manutenção → documentos → devolução → encerramento — e o histórico registra tudo.
- O cliente entra pelo celular e vê **só** o que é dele (testado).
- Cada perfil vê só o que a matriz permite (testado).
- Nenhuma tela quebra em 390 px.
- Tudo pronto para deploy seguindo `DEPLOY.md`, sem mudar código.
