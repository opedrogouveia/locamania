/**
 * Parâmetros configuráveis pela administradora (§12, §14, §42). Vivem na tabela
 * `AppParameter`; esta lista define chave, tipo, grupo, texto e valor padrão —
 * a seed cria os que faltam e a tela de Configurações se desenha a partir dela.
 *
 * Mudar um valor na tela vale na hora: alertas e situações são calculados na
 * leitura, então não existe aviso velho preso no banco.
 */

export type ParameterValueType = 'number' | 'percent' | 'days' | 'km' | 'boolean' | 'list' | 'text';

export interface ParameterDefinition {
  key: ParameterKey;
  group: ParameterGroup;
  label: string;
  description: string;
  valueType: ParameterValueType;
  defaultValue: string;
  /** Limites aceitos (números). */
  min?: number;
  max?: number;
}

export const ParameterGroup = {
  PAYMENTS: 'PAYMENTS',
  DELINQUENCY: 'DELINQUENCY',
  MAINTENANCE: 'MAINTENANCE',
  DOCUMENTS: 'DOCUMENTS',
  CONTRACTS: 'CONTRACTS',
  NOTIFICATIONS: 'NOTIFICATIONS',
} as const;
export type ParameterGroup = (typeof ParameterGroup)[keyof typeof ParameterGroup];

export const PARAMETER_GROUP_LABELS: Record<ParameterGroup, string> = {
  PAYMENTS: 'Pagamentos e avisos',
  DELINQUENCY: 'Inadimplência',
  MAINTENANCE: 'Manutenção',
  DOCUMENTS: 'Documentos',
  CONTRACTS: 'Contratos e frota',
  NOTIFICATIONS: 'Canais de notificação',
};

export const ParameterKey = {
  GRACE_DAYS: 'payments.graceDays',
  DUE_SOON_DAYS: 'payments.dueSoonDays',
  FINE_PERCENT: 'payments.finePercent',
  MONTHLY_INTEREST_PERCENT: 'payments.monthlyInterestPercent',
  REMINDER_OFFSETS: 'payments.reminderOffsets',
  AUTO_BLOCK_ENABLED: 'delinquency.autoBlockEnabled',
  BLOCK_AFTER_DAYS: 'delinquency.blockAfterDays',
  COLLECTION_AFTER_DAYS: 'delinquency.collectionAfterDays',
  MAINTENANCE_WARN_KM: 'maintenance.warnKm',
  MAINTENANCE_WARN_DAYS: 'maintenance.warnDays',
  DOCUMENT_WARN_DAYS: 'documents.warnDays',
  REQUIRED_CUSTOMER_DOCUMENTS: 'documents.requiredCustomerDocuments',
  CONTRACT_ENDING_WARN_DAYS: 'contracts.endingWarnDays',
  IDLE_MOTORCYCLE_DAYS: 'contracts.idleMotorcycleDays',
  EMAIL_ENABLED: 'notifications.emailEnabled',
  WHATSAPP_ENABLED: 'notifications.whatsappEnabled',
  NOTIFY_STAFF_PAYMENT_CONFIRMED: 'notifications.staffPaymentConfirmed',
} as const;
export type ParameterKey = (typeof ParameterKey)[keyof typeof ParameterKey];

const K = ParameterKey;
const G = ParameterGroup;

export const PARAMETER_DEFINITIONS: ParameterDefinition[] = [
  { key: K.GRACE_DAYS, group: G.PAYMENTS, label: 'Tolerância após o vencimento', description: 'Dias depois do vencimento em que o pagamento ainda não é considerado atrasado e não tem multa nem juros.', valueType: 'days', defaultValue: '1', min: 0, max: 30 },
  { key: K.DUE_SOON_DAYS, group: G.PAYMENTS, label: '"Próximo do vencimento" a partir de', description: 'Quantos dias antes do vencimento a cobrança passa a aparecer como próxima.', valueType: 'days', defaultValue: '3', min: 0, max: 30 },
  { key: K.FINE_PERCENT, group: G.PAYMENTS, label: 'Multa por atraso', description: 'Percentual único sobre o valor, aplicado depois da tolerância.', valueType: 'percent', defaultValue: '2', min: 0, max: 20 },
  { key: K.MONTHLY_INTEREST_PERCENT, group: G.PAYMENTS, label: 'Juros ao mês', description: 'Cobrados por dia de atraso (proporcional), contados do vencimento.', valueType: 'percent', defaultValue: '1', min: 0, max: 10 },
  { key: K.REMINDER_OFFSETS, group: G.PAYMENTS, label: 'Quando avisar o cliente', description: 'Dias em relação ao vencimento, separados por vírgula. Positivo = antes, 0 = no dia, negativo = depois. Ex.: 7,3,1,0,-1,-3.', valueType: 'list', defaultValue: '7,3,1,0,-1,-3' },
  { key: K.AUTO_BLOCK_ENABLED, group: G.DELINQUENCY, label: 'Bloquear o cliente automaticamente', description: 'Muda a situação do cliente para Bloqueado depois do prazo abaixo. Não bloqueia a moto: isso é sempre uma ação manual e confirmada.', valueType: 'boolean', defaultValue: 'false' },
  { key: K.BLOCK_AFTER_DAYS, group: G.DELINQUENCY, label: 'Bloqueio administrativo após', description: 'Dias de atraso para sugerir (ou aplicar, se ligado acima) o bloqueio do cliente.', valueType: 'days', defaultValue: '5', min: 1, max: 90 },
  { key: K.COLLECTION_AFTER_DAYS, group: G.DELINQUENCY, label: 'Encaminhar para cobrança após', description: 'Dias de atraso para marcar o cliente como "em cobrança".', valueType: 'days', defaultValue: '15', min: 1, max: 180 },
  { key: K.MAINTENANCE_WARN_KM, group: G.MAINTENANCE, label: 'Avisar quando faltarem', description: 'Quilômetros antes do limite do plano.', valueType: 'km', defaultValue: '300', min: 0, max: 5000 },
  { key: K.MAINTENANCE_WARN_DAYS, group: G.MAINTENANCE, label: 'Avisar com antecedência de', description: 'Dias antes da data prevista do plano.', valueType: 'days', defaultValue: '15', min: 0, max: 90 },
  { key: K.DOCUMENT_WARN_DAYS, group: G.DOCUMENTS, label: 'Avisar vencimento de documentos com', description: 'Dias de antecedência para CNH, CRLV, licenciamento, IPVA e seguro.', valueType: 'days', defaultValue: '30', min: 1, max: 180 },
  { key: K.REQUIRED_CUSTOMER_DOCUMENTS, group: G.DOCUMENTS, label: 'Documentos exigidos do cliente', description: 'Códigos dos tipos de documento que todo cliente deve entregar, separados por vírgula.', valueType: 'list', defaultValue: 'CNH,PROOF_OF_ADDRESS,ID_DOCUMENT' },
  { key: K.CONTRACT_ENDING_WARN_DAYS, group: G.CONTRACTS, label: 'Avisar fim de contrato com', description: 'Dias de antecedência do término do contrato.', valueType: 'days', defaultValue: '15', min: 1, max: 90 },
  { key: K.IDLE_MOTORCYCLE_DAYS, group: G.CONTRACTS, label: 'Moto parada após', description: 'Dias disponível sem aluguel para aparecer como "moto parada".', valueType: 'days', defaultValue: '7', min: 1, max: 90 },
  { key: K.EMAIL_ENABLED, group: G.NOTIFICATIONS, label: 'Enviar avisos por e-mail', description: 'Além do aviso no aplicativo, envia e-mail para quem tem e-mail cadastrado.', valueType: 'boolean', defaultValue: 'true' },
  { key: K.WHATSAPP_ENABLED, group: G.NOTIFICATIONS, label: 'Enviar avisos pelo WhatsApp', description: 'Exige a integração oficial (WhatsApp Business Platform) configurada. Sem ela, os avisos oferecem o botão de enviar pelo WhatsApp.', valueType: 'boolean', defaultValue: 'false' },
  { key: K.NOTIFY_STAFF_PAYMENT_CONFIRMED, group: G.NOTIFICATIONS, label: 'Avisar a equipe a cada pagamento confirmado', description: 'Cria um aviso "Pagamento recebido" no painel para cada confirmação.', valueType: 'boolean', defaultValue: 'true' },
];

export function parameterDefinition(key: string): ParameterDefinition | undefined {
  return PARAMETER_DEFINITIONS.find((d) => d.key === key);
}

/** Lista "7, 3, 1" → [7, 3, 1] (ignora o que não for número). */
export function parseNumberList(value: string): number[] {
  return value
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

export function parseList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
