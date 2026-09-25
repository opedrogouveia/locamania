# BACKLOG — o que fica para depois do MVP

> Registrado para não se perder. Prioridade sugerida entre parênteses; decidir com a cliente.
> Ao começar um item: mover para `specs/` com uma spec curta (ver `specs/README.md`).

## Integrações reais (dependem de conta/contrato de terceiro)

| Item | Hoje no MVP | O que falta | Prioridade |
|---|---|---|---|
| Gateway PIX real | sandbox com webhook assinado e idempotente | escolher gateway (Asaas, Mercado Pago, Efí), adaptador da porta `PaymentGateway`, chaves | (alta) |
| WhatsApp automático | link `wa.me` com mensagem pronta | WhatsApp Business Platform (Meta), templates aprovados, adaptador `WhatsAppChannel` | (alta) |
| Rastreador real + bloqueio | sandbox com capacidades por provedor | fornecedor do equipamento, adaptador `TrackerProvider`, regra de bloqueio só com moto parada se o equipamento permitir | (média) |
| Assinatura eletrônica com provedor | aceite no app (senha + IP + navegador + hash) e upload do papel assinado | ZapSign/Clicksign/D4Sign via adaptador | (baixa) |
| E-mail com domínio próprio | SMTP pronto (Resend) | verificar domínio | (alta — é só configuração) |

## Produto

- (média) **Push no celular** (web push/VAPID) — hoje: avisos no app com contador + e-mail + WhatsApp link.
- (média) **Armazenamento de arquivos em storage** (Supabase Storage/S3) em vez de bytes no banco — quando o banco passar de ~300 MB.
- (média) **Mapa** no rastreamento (hoje: link para o Google Maps com a posição).
- (média) **Histórico de localização** completo por moto (hoje: última posição).
- (baixa) Colunas configuráveis por usuário nas listas.
- (baixa) SMS.
- (baixa) App nativo nas lojas (a PWA instalável cobre o uso atual).
- (baixa) Multiempresa (várias locadoras no mesmo sistema).

## Fora de escopo (decisão)

- Contabilidade e emissão de nota fiscal — usar o sistema do contador; o financeiro exporta Excel.
- Anonimização LGPD automatizada — hoje é sob demanda (arquivar + remover dados pessoais à mão).

## Técnico

- (média) Testes E2E de tela (Playwright) do fluxo de aluguel completo — hoje: `scripts/smoke.mjs` na API + revisão visual.
- (média) Migrar o Render para o plano pago quando houver uso diário (sem hibernação).
- (baixa) Sentry ligado em produção (`SENTRY_DSN`).
