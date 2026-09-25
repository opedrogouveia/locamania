import { StaffRole } from './enums';

/**
 * Permissões da equipe (§28 dos requisitos).
 *
 * O papel dá um conjunto inicial (DEFAULT_ROLE_PERMISSIONS); o Proprietário
 * pode editar a matriz em Configurações › Permissões, e ela é gravada no banco.
 * `OWNER` sempre tem tudo — travado, para ninguém se trancar fora do sistema.
 *
 * `.view` libera a leitura; `.manage` libera criar, editar e arquivar.
 * Valores em dinheiro dependem de `payments.view` (cobranças, aluguel, caução)
 * e `finance.view` (receitas, despesas, custos): sem elas o dado não sai da API.
 */
export const Permission = {
  DASHBOARD_VIEW: 'dashboard.view',
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',
  MOTORCYCLES_VIEW: 'motorcycles.view',
  MOTORCYCLES_MANAGE: 'motorcycles.manage',
  CONTRACTS_VIEW: 'contracts.view',
  CONTRACTS_MANAGE: 'contracts.manage',
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_MANAGE: 'payments.manage',
  FINANCE_VIEW: 'finance.view',
  FINANCE_MANAGE: 'finance.manage',
  MAINTENANCE_VIEW: 'maintenance.view',
  MAINTENANCE_MANAGE: 'maintenance.manage',
  OCCURRENCES_VIEW: 'occurrences.view',
  OCCURRENCES_MANAGE: 'occurrences.manage',
  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_MANAGE: 'documents.manage',
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  NOTIFICATIONS_SEND: 'notifications.send',
  SUPPORT_MANAGE: 'support.manage',
  TRACKING_VIEW: 'tracking.view',
  TRACKING_COMMAND: 'tracking.command',
  AUDIT_VIEW: 'audit.view',
  SETTINGS_MANAGE: 'settings.manage',
  USERS_MANAGE: 'users.manage',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];
export const ALL_PERMISSIONS = Object.values(Permission) as Permission[];

export interface PermissionMeta {
  key: Permission;
  group: string;
  label: string;
  description: string;
}

/** Catálogo para a tela de permissões — agrupado e descrito em pt-BR. */
export const PERMISSION_CATALOG: PermissionMeta[] = [
  { key: Permission.DASHBOARD_VIEW, group: 'Geral', label: 'Ver o painel inicial', description: 'Indicadores e alertas da operação.' },
  { key: Permission.CUSTOMERS_VIEW, group: 'Clientes', label: 'Ver clientes', description: 'Lista e ficha completa dos clientes.' },
  { key: Permission.CUSTOMERS_MANAGE, group: 'Clientes', label: 'Cadastrar e editar clientes', description: 'Inclui bloquear e enviar acesso ao aplicativo.' },
  { key: Permission.MOTORCYCLES_VIEW, group: 'Motos', label: 'Ver motos', description: 'Frota, fichas e histórico das motos.' },
  { key: Permission.MOTORCYCLES_MANAGE, group: 'Motos', label: 'Cadastrar e editar motos', description: 'Inclui mudar a situação e registrar quilometragem.' },
  { key: Permission.CONTRACTS_VIEW, group: 'Contratos', label: 'Ver contratos', description: 'Contratos e cronogramas.' },
  { key: Permission.CONTRACTS_MANAGE, group: 'Contratos', label: 'Criar e alterar contratos', description: 'Novo aluguel, assinatura, entrega, reajuste e devolução.' },
  { key: Permission.PAYMENTS_VIEW, group: 'Pagamentos', label: 'Ver pagamentos e valores', description: 'Cobranças, valor do aluguel e caução.' },
  { key: Permission.PAYMENTS_MANAGE, group: 'Pagamentos', label: 'Registrar pagamentos', description: 'Dar baixa, estornar e criar cobranças avulsas.' },
  { key: Permission.FINANCE_VIEW, group: 'Financeiro', label: 'Ver o financeiro', description: 'Receitas, despesas, custos e resultado.' },
  { key: Permission.FINANCE_MANAGE, group: 'Financeiro', label: 'Lançar receitas e despesas', description: 'Lançamentos manuais do financeiro.' },
  { key: Permission.MAINTENANCE_VIEW, group: 'Manutenção', label: 'Ver manutenções', description: 'Planos, alertas e registros.' },
  { key: Permission.MAINTENANCE_MANAGE, group: 'Manutenção', label: 'Registrar manutenções', description: 'Agendar, iniciar e concluir manutenções.' },
  { key: Permission.OCCURRENCES_VIEW, group: 'Ocorrências', label: 'Ver ocorrências e multas', description: 'Multas, acidentes, avarias e outros.' },
  { key: Permission.OCCURRENCES_MANAGE, group: 'Ocorrências', label: 'Registrar ocorrências', description: 'Cadastrar, resolver e cobrar do cliente.' },
  { key: Permission.DOCUMENTS_VIEW, group: 'Documentos', label: 'Ver documentos e fotos', description: 'Anexos de clientes, motos e contratos.' },
  { key: Permission.DOCUMENTS_MANAGE, group: 'Documentos', label: 'Enviar e arquivar documentos', description: 'Anexar arquivos e fotos.' },
  { key: Permission.REPORTS_VIEW, group: 'Relatórios', label: 'Ver relatórios', description: 'Frota, clientes, financeiro, manutenção e aluguéis.' },
  { key: Permission.REPORTS_EXPORT, group: 'Relatórios', label: 'Exportar relatórios', description: 'PDF e Excel.' },
  { key: Permission.NOTIFICATIONS_SEND, group: 'Comunicação', label: 'Enviar avisos aos clientes', description: 'Avisos da Locamania no aplicativo e por e-mail.' },
  { key: Permission.SUPPORT_MANAGE, group: 'Comunicação', label: 'Responder o suporte', description: 'Mensagens enviadas pelos clientes.' },
  { key: Permission.TRACKING_VIEW, group: 'Rastreamento', label: 'Ver rastreamento', description: 'Posição e última comunicação das motos.' },
  { key: Permission.TRACKING_COMMAND, group: 'Rastreamento', label: 'Bloquear e desbloquear motos', description: 'Envia comando ao rastreador, com confirmação e motivo.' },
  { key: Permission.AUDIT_VIEW, group: 'Administração', label: 'Ver o histórico de alterações', description: 'Auditoria completa do sistema.' },
  { key: Permission.SETTINGS_MANAGE, group: 'Administração', label: 'Alterar configurações', description: 'Empresa, regras, catálogos e integrações.' },
  { key: Permission.USERS_MANAGE, group: 'Administração', label: 'Gerenciar usuários e permissões', description: 'Criar usuários e editar esta matriz.' },
];

const P = Permission;

export const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS.filter((p) => p !== P.USERS_MANAGE),
  FINANCE: [
    P.DASHBOARD_VIEW,
    P.CUSTOMERS_VIEW,
    P.MOTORCYCLES_VIEW,
    P.CONTRACTS_VIEW,
    P.PAYMENTS_VIEW,
    P.PAYMENTS_MANAGE,
    P.FINANCE_VIEW,
    P.FINANCE_MANAGE,
    P.MAINTENANCE_VIEW,
    P.OCCURRENCES_VIEW,
    P.DOCUMENTS_VIEW,
    P.REPORTS_VIEW,
    P.REPORTS_EXPORT,
  ],
  STAFF: [
    P.DASHBOARD_VIEW,
    P.CUSTOMERS_VIEW,
    P.CUSTOMERS_MANAGE,
    P.MOTORCYCLES_VIEW,
    P.MOTORCYCLES_MANAGE,
    P.CONTRACTS_VIEW,
    P.MAINTENANCE_VIEW,
    P.MAINTENANCE_MANAGE,
    P.OCCURRENCES_VIEW,
    P.OCCURRENCES_MANAGE,
    P.DOCUMENTS_VIEW,
    P.DOCUMENTS_MANAGE,
    P.SUPPORT_MANAGE,
    P.TRACKING_VIEW,
  ],
};

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}
