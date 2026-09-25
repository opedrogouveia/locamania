import type {
  ActorType,
  AuditAction,
  ChargeDisplayStatus,
  ChargeKind,
  ContractStatus,
  CustomerStatus,
  DepositOutcome,
  DocumentOwnerType,
  FuelLevel,
  MaintenanceDueStatus,
  MaintenanceStatus,
  MotorcycleStatus,
  NotificationType,
  OccurrenceStatus,
  OccurrenceType,
  OdometerSource,
  PaymentMethod,
  PaymentPeriodicity,
  ReturnCondition,
  SignatureMethod,
  StaffRole,
  SupportMessageStatus,
  TrackerCommandStatus,
  TrackerCommandType,
} from './enums';

/**
 * Rótulos em pt-BR de todos os enums — um lugar só. Backend (PDF, e-mail,
 * relatório) e frontend usam os mesmos textos; renomear aqui muda o sistema
 * inteiro sem tocar em dado gravado.
 */

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  OWNER: 'Proprietário',
  ADMIN: 'Administrador',
  FINANCE: 'Financeiro',
  STAFF: 'Funcionário',
};

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  OVERDUE: 'Em atraso',
  CONTRACT_ENDED: 'Contrato encerrado',
  BLOCKED: 'Bloqueado',
};

export const MOTORCYCLE_STATUS_LABELS: Record<MotorcycleStatus, string> = {
  AVAILABLE: 'Disponível',
  RENTED: 'Alugada',
  RESERVED: 'Reservada',
  MAINTENANCE: 'Em manutenção',
  BLOCKED: 'Bloqueada',
  INACTIVE: 'Inativa/vendida',
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo',
  ENDED: 'Encerrado',
  CANCELLED: 'Cancelado',
};

export const SIGNATURE_METHOD_LABELS: Record<SignatureMethod, string> = {
  IN_PERSON: 'Assinado presencialmente',
  ELECTRONIC_ACCEPTANCE: 'Aceite eletrônico no aplicativo',
  PROVIDER: 'Assinatura eletrônica (provedor)',
};

export const PERIODICITY_LABELS: Record<PaymentPeriodicity, string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
};

/** "R$ 350 por semana". */
export const PERIODICITY_UNIT: Record<PaymentPeriodicity, string> = {
  WEEKLY: 'semana',
  BIWEEKLY: 'quinzena',
  MONTHLY: 'mês',
};

export const CHARGE_KIND_LABELS: Record<ChargeKind, string> = {
  RENT: 'Aluguel',
  DEPOSIT: 'Caução',
  FINE: 'Multa',
  DAMAGE: 'Avaria',
  OTHER: 'Outros',
};

export const CHARGE_STATUS_LABELS: Record<ChargeDisplayStatus, string> = {
  PAID: 'Pago',
  UPCOMING: 'A vencer',
  DUE_SOON: 'Próximo do vencimento',
  OVERDUE: 'Em atraso',
  CANCELLED: 'Cancelado',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: 'PIX',
  CASH: 'Dinheiro',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BANK_TRANSFER: 'Transferência',
  BOLETO: 'Boleto',
  OTHER: 'Outro',
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  SCHEDULED: 'Agendada',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Realizada',
  CANCELLED: 'Cancelada',
};

export const MAINTENANCE_DUE_LABELS: Record<MaintenanceDueStatus, string> = {
  OK: 'Em dia',
  DUE_SOON: 'Próxima',
  OVERDUE: 'Vencida',
};

export const OCCURRENCE_TYPE_LABELS: Record<OccurrenceType, string> = {
  TRAFFIC_FINE: 'Multa',
  ACCIDENT: 'Acidente',
  DAMAGE: 'Avaria',
  THEFT: 'Furto/roubo',
  MECHANICAL_ISSUE: 'Problema mecânico',
  OTHER: 'Outros',
};

export const OCCURRENCE_STATUS_LABELS: Record<OccurrenceStatus, string> = {
  OPEN: 'Aberta',
  IN_PROGRESS: 'Em andamento',
  RESOLVED: 'Resolvida',
  CANCELLED: 'Cancelada',
};

export const ODOMETER_SOURCE_LABELS: Record<OdometerSource, string> = {
  CONTRACT_START: 'Entrega ao cliente',
  RETURN: 'Devolução',
  MAINTENANCE: 'Manutenção',
  MANUAL: 'Registro manual',
  CUSTOMER: 'Informado pelo cliente',
  TRACKER: 'Rastreador',
};

export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  GOOD: 'Bom estado',
  FAIR: 'Desgaste normal',
  DAMAGED: 'Com avarias',
};

export const FUEL_LEVEL_LABELS: Record<FuelLevel, string> = {
  EMPTY: 'Reserva',
  QUARTER: '1/4',
  HALF: '1/2',
  THREE_QUARTERS: '3/4',
  FULL: 'Cheio',
};

export const DEPOSIT_OUTCOME_LABELS: Record<DepositOutcome, string> = {
  NONE: 'Sem caução',
  REFUNDED: 'Devolvida ao cliente',
  RETAINED: 'Retida',
  PARTIALLY_RETAINED: 'Retida em parte',
};

export const DOCUMENT_OWNER_LABELS: Record<DocumentOwnerType, string> = {
  CUSTOMER: 'Cliente',
  MOTORCYCLE: 'Moto',
  CONTRACT: 'Contrato',
  MAINTENANCE: 'Manutenção',
  OCCURRENCE: 'Ocorrência',
  CHARGE: 'Pagamento',
  RETURN: 'Devolução',
  FINANCIAL_ENTRY: 'Lançamento financeiro',
};

export const SUPPORT_STATUS_LABELS: Record<SupportMessageStatus, string> = {
  OPEN: 'Aguardando resposta',
  ANSWERED: 'Respondida',
  CLOSED: 'Encerrada',
};

export const TRACKER_COMMAND_LABELS: Record<TrackerCommandType, string> = {
  BLOCK: 'Bloqueio',
  UNBLOCK: 'Desbloqueio',
};

export const TRACKER_COMMAND_STATUS_LABELS: Record<TrackerCommandStatus, string> = {
  REQUESTED: 'Solicitado',
  SENT: 'Enviado ao equipamento',
  CONFIRMED: 'Confirmado pelo equipamento',
  FAILED: 'Falhou',
  SIMULATED: 'Simulado (sem equipamento)',
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: 'Criou',
  UPDATE: 'Alterou',
  DELETE: 'Arquivou',
  LOGIN: 'Entrou no sistema',
  LOGOUT: 'Saiu do sistema',
  STATUS_CHANGE: 'Mudou a situação',
  EXPORT: 'Exportou',
  COMMAND: 'Enviou comando',
};

export const ACTOR_TYPE_LABELS: Record<ActorType, string> = {
  USER: 'Equipe',
  CUSTOMER: 'Cliente',
  SYSTEM: 'Sistema',
};

/** Nome amigável das entidades gravadas no AuditLog (`entityType` = model do Prisma). */
export const ENTITY_LABELS: Record<string, string> = {
  User: 'usuário',
  RolePermission: 'permissões',
  Customer: 'cliente',
  Motorcycle: 'moto',
  OdometerReading: 'quilometragem',
  Contract: 'contrato',
  Charge: 'cobrança',
  GatewayEvent: 'evento do gateway',
  MaintenanceType: 'tipo de manutenção',
  MaintenancePlan: 'plano de manutenção',
  MaintenanceRecord: 'manutenção',
  Occurrence: 'ocorrência',
  ReturnInspection: 'devolução',
  Document: 'documento',
  FinancialEntry: 'lançamento financeiro',
  Notification: 'notificação',
  Announcement: 'aviso',
  SupportMessage: 'mensagem de suporte',
  TrackerCommand: 'comando do rastreador',
  CatalogItem: 'item de catálogo',
  AppParameter: 'parâmetro',
  CompanySettings: 'dados da empresa',
  Report: 'relatório',
};

/** Nome amigável de campos, para o histórico dizer "alterou o valor do aluguel". */
export const FIELD_LABELS: Record<string, string> = {
  name: 'nome',
  email: 'e-mail',
  phone: 'telefone',
  whatsapp: 'WhatsApp',
  cpf: 'CPF',
  rg: 'RG',
  birthDate: 'data de nascimento',
  postalCode: 'CEP',
  street: 'endereço',
  streetNumber: 'número',
  complement: 'complemento',
  district: 'bairro',
  city: 'cidade',
  state: 'estado',
  cnhNumber: 'número da CNH',
  cnhCategory: 'categoria da CNH',
  cnhExpiresAt: 'validade da CNH',
  status: 'situação',
  manualStatus: 'situação',
  blockedReason: 'motivo do bloqueio',
  notes: 'observações',
  portalEnabled: 'acesso ao aplicativo',
  role: 'perfil',
  active: 'ativo',
  permissions: 'permissões',
  brandCode: 'marca',
  modelCode: 'modelo',
  manufactureYear: 'ano',
  modelYear: 'ano do modelo',
  color: 'cor',
  plate: 'placa',
  renavam: 'RENAVAM',
  chassis: 'chassi',
  currentKm: 'quilometragem',
  km: 'quilometragem',
  acquiredAt: 'data de aquisição',
  purchasePrice: 'valor da moto',
  hasTracker: 'rastreador',
  trackerDeviceId: 'identificação do rastreador',
  rentAmount: 'valor do aluguel',
  depositAmount: 'caução',
  startDate: 'data de início',
  endDate: 'data de término',
  firstDueDate: 'primeiro vencimento',
  periodicity: 'periodicidade',
  rules: 'regras específicas',
  initialKm: 'quilometragem inicial',
  signatureStatus: 'assinatura',
  amount: 'valor',
  dueDate: 'vencimento',
  paidAt: 'data do pagamento',
  paidAmount: 'valor pago',
  method: 'forma de pagamento',
  cost: 'custo',
  value: 'valor',
  deletedAt: 'arquivamento',
};

/** Catálogo dos eventos de notificação — tela de configuração e textos padrão. */
export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  { label: string; audience: 'CUSTOMER' | 'STAFF' | 'BOTH' }
> = {
  PAYMENT_REMINDER: { label: 'Lembrete de pagamento', audience: 'CUSTOMER' },
  PAYMENT_DUE_TODAY: { label: 'Pagamento vence hoje', audience: 'BOTH' },
  PAYMENT_OVERDUE: { label: 'Pagamento em atraso', audience: 'BOTH' },
  PAYMENT_CONFIRMED: { label: 'Pagamento confirmado', audience: 'BOTH' },
  MAINTENANCE_DUE_SOON: { label: 'Manutenção próxima', audience: 'BOTH' },
  MAINTENANCE_OVERDUE: { label: 'Manutenção vencida', audience: 'BOTH' },
  CONTRACT_ENDING: { label: 'Contrato perto do fim', audience: 'BOTH' },
  CONTRACT_UPDATED: { label: 'Alteração no aluguel', audience: 'CUSTOMER' },
  ANNOUNCEMENT: { label: 'Aviso da Locamania', audience: 'CUSTOMER' },
  SUPPORT_REPLY: { label: 'Resposta do suporte', audience: 'CUSTOMER' },
  CUSTOMER_DELINQUENT: { label: 'Cliente inadimplente', audience: 'STAFF' },
  DOCUMENT_EXPIRING: { label: 'Documento vencendo', audience: 'STAFF' },
  DOCUMENT_EXPIRED: { label: 'Documento vencido', audience: 'STAFF' },
  MOTORCYCLE_IDLE: { label: 'Moto parada', audience: 'STAFF' },
  OCCURRENCE_CREATED: { label: 'Nova ocorrência', audience: 'STAFF' },
  SUPPORT_MESSAGE: { label: 'Mensagem de cliente', audience: 'STAFF' },
  ODOMETER_REPORTED: { label: 'Quilometragem informada pelo cliente', audience: 'STAFF' },
};
