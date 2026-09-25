import { PERMISSION_CATALOG, type CatalogGroup, type IntegrationStatusDto, type ParameterValueType, type Permission, type StaffRole } from '@locamania/shared';
import { Activity, FileSignature, Mail, MapPin, MessageCircle, QrCode, type LucideIcon } from 'lucide-react';

import type { BadgeProps } from '@/components/ui/badge';

type Variant = NonNullable<BadgeProps['variant']>;

// ───────────────────────────── Listas (CatalogItem) ─────────────────────────────

export const CATALOG_GROUP_META: Record<CatalogGroup, { label: string; tab: string; singular: string; description: string; placeholder: string }> = {
  MOTORCYCLE_BRAND: {
    label: 'Marcas de moto',
    tab: 'Marcas',
    singular: 'marca',
    description: 'Aparecem no cadastro da moto e nos relatórios da frota.',
    placeholder: 'Ex.: Honda',
  },
  MOTORCYCLE_MODEL: {
    label: 'Modelos de moto',
    tab: 'Modelos',
    singular: 'modelo',
    description: 'Aparecem no cadastro da moto e nos relatórios da frota.',
    placeholder: 'Ex.: CG 160 Titan',
  },
  DOCUMENT_TYPE: {
    label: 'Tipos de documento',
    tab: 'Documentos',
    singular: 'tipo de documento',
    description: 'Usados ao anexar documentos de clientes, motos e contratos.',
    placeholder: 'Ex.: Comprovante de renda',
  },
  EXPENSE_CATEGORY: {
    label: 'Categorias de despesa',
    tab: 'Despesas',
    singular: 'categoria de despesa',
    description: 'Agrupam os gastos no financeiro e nos relatórios.',
    placeholder: 'Ex.: Combustível',
  },
  INCOME_CATEGORY: {
    label: 'Categorias de receita',
    tab: 'Receitas',
    singular: 'categoria de receita',
    description: 'Agrupam as entradas no financeiro e nos relatórios.',
    placeholder: 'Ex.: Venda de moto',
  },
};

// ───────────────────────────── Parâmetros ─────────────────────────────

/** Sufixo do campo e unidade no texto ("3 dias", "2%", "300 km"). */
export const PARAMETER_UNIT: Partial<Record<ParameterValueType, { suffix: string; one?: string; many?: string }>> = {
  days: { suffix: 'dias', one: 'dia', many: 'dias' },
  percent: { suffix: '%' },
  km: { suffix: 'km', one: 'km', many: 'km' },
};

/**
 * Descrição de tela para parâmetros cuja edição aqui não é por texto (os
 * textos do shared falam em "separados por vírgula", que a tela não usa).
 */
export const PARAMETER_DESCRIPTION: Record<string, string> = {
  'payments.reminderOffsets': 'Em quais dias o cliente recebe lembrete de cada cobrança. Toque para ligar ou desligar cada dia.',
  'documents.requiredCustomerDocuments': 'O que todo cliente precisa entregar. A ficha do cliente mostra o que está faltando.',
};

/** Rótulo curto do grupo, para os filtros caberem numa linha. */
export const PARAMETER_GROUP_SHORT: Record<string, string> = {
  PAYMENTS: 'Pagamentos',
  DELINQUENCY: 'Inadimplência',
  MAINTENANCE: 'Manutenção',
  DOCUMENTS: 'Documentos',
  CONTRACTS: 'Contratos e frota',
  NOTIFICATIONS: 'Canais',
};

/** "3 dias", "2%", "300 km", "Sim". */
export function formatParameterValue(valueType: ParameterValueType, value: string): string {
  if (valueType === 'boolean') return value === 'true' ? 'Ligado' : 'Desligado';
  if (valueType === 'percent') return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`;
  const unit = PARAMETER_UNIT[valueType];
  if (unit?.one) {
    const n = Number(value);
    return `${n.toLocaleString('pt-BR')} ${n === 1 ? unit.one : unit.many}`;
  }
  return value;
}

/** Um marco do lembrete em palavras: 7 → "7 dias antes", 0 → "No dia", -1 → "1 dia depois". */
export function reminderOffsetLabel(offset: number): string {
  if (offset === 0) return 'No dia do vencimento';
  const n = Math.abs(offset);
  return `${n} ${n === 1 ? 'dia' : 'dias'} ${offset > 0 ? 'antes' : 'depois'}`;
}

// ───────────────────────────── Integrações ─────────────────────────────

export type IntegrationState = 'ready' | 'sandbox' | 'off';

export function integrationState(i: IntegrationStatusDto): IntegrationState {
  if (i.sandbox) return 'sandbox';
  return i.configured ? 'ready' : 'off';
}

export const INTEGRATION_STATE_META: Record<IntegrationState, { label: string; variant: Variant }> = {
  ready: { label: 'Funcionando', variant: 'success' },
  sandbox: { label: 'Modo de teste', variant: 'warning' },
  off: { label: 'Não configurada', variant: 'muted' },
};

/** Ícone e "o que falta", em linguagem simples, para cada integração. */
export const INTEGRATION_META: Record<IntegrationStatusDto['key'], { icon: LucideIcon; missing: string }> = {
  payments: {
    icon: QrCode,
    missing: 'Escolher o banco ou intermediador do PIX (Asaas, Mercado Pago, Efí…) e cadastrar as chaves de acesso na publicação do sistema.',
  },
  whatsapp: {
    icon: MessageCircle,
    missing: 'Conta na WhatsApp Business Platform aprovada pela Meta e os modelos de mensagem aprovados. Até lá, os botões de WhatsApp abrem a conversa com o texto pronto.',
  },
  email: {
    icon: Mail,
    missing: 'Cadastrar o serviço de envio de e-mails (SMTP) e o remetente oficial na publicação do sistema.',
  },
  tracker: {
    icon: MapPin,
    missing: 'Acesso à API do fornecedor do rastreador (usuário, chave e lista de equipamentos).',
  },
  signature: {
    icon: FileSignature,
    missing: 'Opcional: contratar um serviço de assinatura digital (ZapSign, Clicksign) para validade jurídica reforçada.',
  },
  sentry: {
    icon: Activity,
    missing: 'Criar a conta de monitoramento e cadastrar a chave na publicação do sistema.',
  },
};

// ───────────────────────────── Rotinas (jobs) ─────────────────────────────

export const JOB_NAME_LABELS: Record<string, string> = { daily: 'Rotina diária' };

export const JOB_TRIGGER_LABELS: Record<string, string> = {
  cron: 'Automática',
  scheduler: 'Agendador',
  manual: 'Manual',
};

export const JOB_STATUS_META: Record<'RUNNING' | 'SUCCESS' | 'FAILED', { label: string; variant: Variant }> = {
  RUNNING: { label: 'Rodando', variant: 'info' },
  SUCCESS: { label: 'Concluída', variant: 'success' },
  FAILED: { label: 'Falhou', variant: 'destructive' },
};

/** Chave do resumo → [singular, plural]. Chaves antigas e novas convivem. */
const SUMMARY_LABELS: Record<string, [string, string]> = {
  overdueMarked: ['cobrança marcada como atrasada', 'cobranças marcadas como atrasadas'],
  remindersSent: ['lembrete de pagamento enviado', 'lembretes de pagamento enviados'],
  autoBlocked: ['cliente bloqueado por atraso', 'clientes bloqueados por atraso'],
  blockSuggested: ['sugestão de bloqueio', 'sugestões de bloqueio'],
  sentToCollection: ['cliente encaminhado para cobrança', 'clientes encaminhados para cobrança'],
  customerStatusesUpdated: ['situação de cliente atualizada', 'situações de clientes atualizadas'],
  maintenanceAlerts: ['aviso de manutenção', 'avisos de manutenção'],
  documentAlerts: ['aviso de documento vencendo', 'avisos de documentos vencendo'],
  contractAlerts: ['aviso de fim de contrato', 'avisos de fim de contrato'],
  contractEndingAlerts: ['aviso de fim de contrato', 'avisos de fim de contrato'],
  idleAlerts: ['aviso de moto parada', 'avisos de moto parada'],
  idleMotorcycleAlerts: ['aviso de moto parada', 'avisos de moto parada'],
  emailsSent: ['e-mail enviado', 'e-mails enviados'],
};

export interface SummaryLine {
  key: string;
  count: number;
  text: string;
}

/** Resumo da execução em frases ("13 lembretes de pagamento enviados"), sem os zeros. */
export function jobSummaryLines(summary: Record<string, unknown> | null): { lines: SummaryLine[]; error: string | null } {
  if (!summary) return { lines: [], error: null };
  const lines: SummaryLine[] = [];
  for (const [key, raw] of Object.entries(summary)) {
    const label = SUMMARY_LABELS[key];
    if (!label || typeof raw !== 'number' || raw <= 0) continue;
    lines.push({ key, count: raw, text: `${raw.toLocaleString('pt-BR')} ${raw === 1 ? label[0] : label[1]}` });
  }
  return { lines, error: typeof summary.error === 'string' ? summary.error : null };
}

// ───────────────────────────── Perfis e permissões ─────────────────────────────

/** Resumo do perfil (padrão de §28; a matriz é editável em Permissões). */
export const ROLE_HINT: Record<StaffRole, string> = {
  OWNER: 'Acesso total',
  ADMIN: 'Quase tudo, menos usuários',
  FINANCE: 'Pagamentos e financeiro',
  STAFF: 'Operação, sem valores',
};

export const ROLE_VARIANT: Record<StaffRole, Variant> = {
  OWNER: 'default',
  ADMIN: 'info',
  FINANCE: 'success',
  STAFF: 'muted',
};

const PERMISSION_KEYS = new Set<string>(PERMISSION_CATALOG.map((p) => p.key));

/**
 * "Registrar pagamentos" sem "Ver pagamentos" não faz sentido: a permissão de
 * fazer depende da de ver do mesmo assunto (x.manage → x.view).
 */
export function permissionRequires(p: Permission): Permission | null {
  const [area, action] = p.split('.');
  if (!area || action === 'view') return null;
  const view = `${area}.view`;
  return PERMISSION_KEYS.has(view) ? (view as Permission) : null;
}

export function permissionDependents(p: Permission): Permission[] {
  return PERMISSION_CATALOG.map((m) => m.key).filter((k) => permissionRequires(k) === p);
}
