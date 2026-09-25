import {
  CONTRACT_STATUS_LABELS,
  CUSTOMER_STATUS_LABELS,
  ENTITY_LABELS,
  FIELD_LABELS,
  MAINTENANCE_STATUS_LABELS,
  MOTORCYCLE_STATUS_LABELS,
  OCCURRENCE_STATUS_LABELS,
  type AuditAction,
} from '@locamania/shared';

/** Campos técnicos que não interessam a quem lê o histórico. */
const IGNORED_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'sessionVersion',
  'passwordHash',
  'seq',
  'number',
  'renderedText',
  'documentHash',
]);

/**
 * Rótulos dos campos que ainda não estão em FIELD_LABELS (shared) — sem isto o
 * histórico mostrava o nome técnico ("StatusReason", "EndedAt").
 */
const EXTRA_FIELD_LABELS: Record<string, string> = {
  availableSince: 'disponível desde',
  statusReason: 'motivo da situação',
  completedAt: 'data de conclusão',
  startedAt: 'início',
  scheduledFor: 'data agendada',
  endedAt: 'data de encerramento',
  cancelledAt: 'data do cancelamento',
  cancelReason: 'motivo do cancelamento',
  deliveredAt: 'data da entrega',
  sentAt: 'data do envio',
  signedAt: 'data da assinatura',
  signatureIp: 'IP da assinatura',
  signatureMethod: 'forma de assinatura',
  gatewayPaidAt: 'pagamento confirmado pelo banco em',
  gatewayExpiresAt: 'validade do PIX',
  parts: 'peças',
  workshop: 'oficina',
  description: 'descrição',
  title: 'título',
  type: 'tipo',
  typeCode: 'tipo de documento',
  kind: 'tipo de cobrança',
  categoryCode: 'categoria',
  supplier: 'fornecedor',
  date: 'data',
  occurredAt: 'data da ocorrência',
  fineNumber: 'nº do auto de infração',
  fineDueDate: 'vencimento da multa',
  fineAmount: 'multa',
  interestAmount: 'juros',
  discountAmount: 'desconto',
  expiresAt: 'validade',
  visibleToCustomer: 'visível no aplicativo',
  inCollection: 'em cobrança',
  collectionSince: 'em cobrança desde',
  privacyAcceptedAt: 'aceite de privacidade',
  portalLastLoginAt: 'último acesso ao aplicativo',
  lastLoginAt: 'último acesso',
  returnedAt: 'data da devolução',
  finalKm: 'quilometragem final',
  condition: 'estado da moto',
  fuelLevel: 'combustível',
  damages: 'avarias',
  pendingItems: 'pendências',
  depositOutcome: 'caução',
  depositRetainedAmount: 'caução retida',
  nextMotorcycleStatus: 'situação da moto depois',
  intervalDays: 'intervalo em dias',
  intervalKm: 'intervalo em km',
  defaultIntervalDays: 'intervalo padrão em dias',
  defaultIntervalKm: 'intervalo padrão em km',
  lastDoneAt: 'última vez feita em',
  lastDoneKm: 'última vez feita com',
  nextDueDate: 'próxima data',
  nextDueKm: 'próxima quilometragem',
  periodStart: 'início do período',
  periodEnd: 'fim do período',
  source: 'origem',
  reason: 'motivo',
  answer: 'resposta',
  answeredAt: 'data da resposta',
  subject: 'assunto',
  body: 'mensagem',
  audience: 'destinatários',
  label: 'nome',
  code: 'código',
  sortOrder: 'ordem',
  group: 'grupo',
  tradeName: 'nome fantasia',
  legalName: 'razão social',
  cnpj: 'CNPJ',
  pixKey: 'chave PIX',
  supportHours: 'horário de atendimento',
  fileName: 'arquivo',
  trackerProvider: 'fornecedor do rastreador',
  providerResponse: 'resposta do rastreador',
};

/** Técnicos que não dizem nada a quem lê (ids de ligação, hashes, navegador). */
const IGNORED_TECH = new Set(['signatureUserAgent', 'gatewayPixCode', 'gatewayProvider', 'dedupeKey', 'correlationId', 'mimeType', 'sizeBytes', 'sequence']);
const isTechnical = (field: string) => IGNORED_FIELDS.has(field) || IGNORED_TECH.has(field) || /Id$/.test(field);

export interface AuditRow {
  action: AuditAction;
  entityType: string;
  actorName: string | null;
  changes: unknown;
}

export interface DescribedAudit {
  summary: string;
  changedFields: { field: string; label: string; to?: unknown }[];
}

function statusLabel(entityType: string, status: unknown): string | null {
  if (typeof status !== 'string') return null;
  const maps: Record<string, Record<string, string>> = {
    Customer: CUSTOMER_STATUS_LABELS,
    Motorcycle: MOTORCYCLE_STATUS_LABELS,
    Contract: CONTRACT_STATUS_LABELS,
    MaintenanceRecord: MAINTENANCE_STATUS_LABELS,
    Occurrence: OCCURRENCE_STATUS_LABELS,
  };
  return maps[entityType]?.[status] ?? null;
}

/**
 * Transforma um registro de auditoria numa frase (§30):
 * "Maria alterou o valor do aluguel do contrato LOC-2026-0012."
 * `entityName` é resolvido fora (nome do cliente, placa, nº do contrato).
 */
export function describeAudit(row: AuditRow, entityName: string | null): DescribedAudit {
  const who = row.actorName ?? 'Sistema';
  const entity = ENTITY_LABELS[row.entityType] ?? row.entityType;
  const target = entityName ? `${entity} ${entityName}` : entity;
  const changes = (row.changes ?? {}) as { data?: Record<string, unknown>; after?: Record<string, unknown> };
  // Registros antigos gravados com `data: "[omitido]"` (bug já corrigido) não viram campos letra a letra.
  const data = changes.data && typeof changes.data === 'object' && !Array.isArray(changes.data) ? changes.data : {};

  const changedFields = Object.entries(data)
    .filter(([field]) => !isTechnical(field))
    .map(([field, to]) => ({ field, label: FIELD_LABELS[field] ?? EXTRA_FIELD_LABELS[field] ?? field, to }));

  let summary: string;
  switch (row.action) {
    case 'LOGIN':
      summary = `${who} entrou no ${row.entityType === 'Customer' ? 'aplicativo' : 'sistema'}.`;
      break;
    case 'LOGOUT':
      summary = `${who} saiu do sistema.`;
      break;
    case 'EXPORT':
      summary = `${who} exportou ${entityName ?? 'um relatório'}.`;
      break;
    case 'COMMAND':
      summary = `${who} enviou um comando ao rastreador da ${target}.`;
      break;
    case 'CREATE':
      summary = `${who} ${row.entityType === 'Charge' ? 'gerou' : 'cadastrou'} ${target}.`;
      break;
    case 'DELETE':
      summary = `${who} arquivou ${target}.`;
      break;
    case 'STATUS_CHANGE': {
      const status = data.status;
      if (row.entityType === 'Charge' && status === 'PAID') summary = `${who} registrou o pagamento da ${target}.`;
      else if (row.entityType === 'Charge' && status === 'CANCELLED') summary = `${who} cancelou a ${target}.`;
      else if (row.entityType === 'Charge' && status === 'PENDING') summary = `${who} estornou o pagamento da ${target}.`;
      else if (row.entityType === 'Contract' && status === 'ACTIVE') summary = `${who} entregou a moto e ativou o ${target}.`;
      else if (row.entityType === 'Contract' && status === 'ENDED') summary = `${who} encerrou o ${target}.`;
      else if (row.entityType === 'Contract' && status === 'CANCELLED') summary = `${who} cancelou o ${target}.`;
      else {
        const label = statusLabel(row.entityType, status);
        summary = label ? `${who} mudou a situação de ${target} para "${label}".` : `${who} mudou a situação de ${target}.`;
      }
      break;
    }
    default: {
      const labels = changedFields.map((f) => f.label);
      const list =
        labels.length === 0
          ? 'dados'
          : labels.length <= 3
            ? labels.join(', ').replace(/, ([^,]*)$/, ' e $1')
            : `${labels.slice(0, 3).join(', ')} e mais ${labels.length - 3}`;
      summary = `${who} alterou ${list} de ${target}.`;
    }
  }
  return { summary, changedFields };
}
