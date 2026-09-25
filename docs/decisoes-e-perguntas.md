# Decisões e perguntas — log

Registro para revisão assíncrona. Convenção (a mesma do SafeKeep):

- **[DECISÃO]** — decidida para não travar; inclui o porquê e como reverter.
- **[PERGUNTA]** — precisa do Pedro ou da cliente.
- **✅ RESPONDIDO** — fechada, com a data.

As decisões de produto assumidas na noite de 24/09/2026 estão também em
[`PLANO_MVP.md`](PLANO_MVP.md) §2 (D1–D18).

---

## Arquitetura (24/09/2026)

### [DECISÃO] Mesma stack e padrão do SafeKeep, com as dívidas fechadas na fundação
Pedido do Pedro. O que muda em relação ao SafeKeep, e por quê:
- **Domínio sem classes de entidade** — tipos de registro + regras puras + portas (as entidades do
  SafeKeep eram getters sem comportamento).
- **Casos de uso agrupados por módulo** num serviço de aplicação (uma classe por caso de uso gerava
  muito arquivo sem ganho).
- **Serviço devolve o DTO do contrato** via mapper, que aplica a ocultação de valores.
- **Paginação, query string e conversões num lugar só** (no SafeKeep eram repetidos).
- **Mensagens de erro em pt-BR + `code` estável** no envelope (no SafeKeep a mensagem saiu no idioma
  errado para o usuário).
- **`frontend/CLAUDE.md` com o nome certo** e skill `/new-module` criada.
Reverter: não há o que reverter; é o padrão.

### [DECISÃO] Prisma 6.19, não 7
O 7 muda a arquitetura de conexão (driver adapters + `prisma.config.ts`) e a auditoria automática é
construída sobre a extensão do client — provada no 6. Migrar é um passo dedicado depois do MVP.

### [DECISÃO] Auditoria na aplicação (extensão do Prisma), triggers depois
Cobre toda escrita feita pela API. Escrita direta no banco (fora da API) não é auditada; se a
Locamania exigir, a camada definitiva são triggers PL/pgSQL (padrão da empresa do Pedro).

### [DECISÃO] Login único para equipe e cliente
E-mail entra no painel; CPF entra no app. Uma URL só. Token carrega `typ` e `ver` (versão de sessão):
trocar senha derruba os outros aparelhos na hora.

### [DECISÃO] Guard "equipe por padrão"
Toda rota que não declara `@CustomerRoute()` recusa token de cliente. Esquecer um decorator nunca
abre dado administrativo para o cliente — no máximo o cliente recebe 403.

### [DECISÃO] Notificação com `recipientId` único obrigatório
No Postgres, `NULL` não conta para unicidade. Com `userId`/`customerId` opcionais, a chave de
deduplicação deixaria passar aviso repetido. Um campo só, obrigatório, resolve.

### [DECISÃO] Backend lê o `.env` sozinho
O Turborepo (modo estrito) filtra variáveis não declaradas no `turbo.json` — o e-mail ficava desligado
sem aviso. `ConfigModule` com `envFilePath: ['.env', '../.env']`; variável do ambiente (Render) vence.

### [DECISÃO] Arquivos como bytes no banco
Documentos e fotos em `Document.data` (bytea), com a imagem reduzida no navegador e limite de 8 MB.
O disco do Render free é efêmero. Quando o volume crescer, migrar para Supabase Storage (a porta é
o próprio módulo de documentos).

### [DECISÃO] Datas "só dia" como `YYYY-MM-DD`
Vencimento gravado como `@db.Date` e trafegado como string. `Date` com hora faria "10/10" virar
"09/10 21h" em São Paulo. "Hoje" sai do `ClockService` (fuso `APP_TIMEZONE`).

### [DECISÃO] Status que muda com o tempo é calculado na leitura
"Próximo do vencimento" e "manutenção próxima/vencida" são calculados a cada leitura; o job diário
só grava o atraso (para filtrar e contar no banco) e dispara os avisos. Mudar um parâmetro na tela
corrige tudo na hora.

### [DECISÃO] Agendador duplo
`@nestjs/schedule` às 08:00 + GitHub Actions chamando `POST /jobs/run` (com segredo), porque o Render
free hiberna e o cron interno não roda dormindo. Os jobs são idempotentes (chave por evento), então
rodar duas vezes não duplica aviso.

---

## Produto (24/09/2026) — assumidas pelo Claude, para o Pedro confirmar

### [PERGUNTA] Cobrança antecipada?
Assumido: a 1ª parcela vence no dia do início (paga antes de usar), e as seguintes a cada período. O
contrato permite outro 1º vencimento. Última parcela proporcional aos dias.

### [PERGUNTA] Tolerância, multa e juros padrão
Assumido: 1 dia de tolerância, multa de 2% e juros de 1% ao mês pro rata. Tudo editável em
Configurações.

### [PERGUNTA] Bloqueio automático do cliente
Assumido: desligado por padrão; ligando, o cliente vira "Bloqueado" após 5 dias de atraso. A moto
**nunca** é bloqueada automaticamente — só por ação manual com confirmação (§32).

### [PERGUNTA] Qual gateway de pagamento?
MVP em sandbox. Opções comuns: Asaas, Mercado Pago, Efí (Gerencianet). Critérios: PIX com webhook,
cobrança recorrente, tarifa. A troca é um adaptador novo.

### [PERGUNTA] Assinatura eletrônica
MVP: aceite no app (data, IP, dispositivo e hash do contrato) ou upload do contrato assinado em
papel. Para validade jurídica mais forte, um provedor (ZapSign, Clicksign, D4Sign). Confirmar com o
jurídico da Locamania.

### [PERGUNTA] Rastreador
Qual fornecedor/equipamento? Com a API dele, implementamos o adaptador (posição, última comunicação,
bloqueio seguro).

### [PERGUNTA] Identidade visual
Logo, cores e fonte da Locamania. Hoje a marca é provisória (azul de interface).
