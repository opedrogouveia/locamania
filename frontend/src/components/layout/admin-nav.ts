import { Permission } from '@locamania/shared';
import {
  AlertTriangle,
  BarChart3,
  Bike,
  ClipboardList,
  FileText,
  FolderOpen,
  History,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MapPin,
  Receipt,
  Settings,
  ShieldAlert,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Aparece se o usuário tiver QUALQUER uma destas. */
  anyOf: Permission[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const P = Permission;

/**
 * Menu do painel. O que o perfil não pode ver nem aparece (a API recusa de
 * qualquer jeito — o menu só não oferece o que vai dar "sem permissão").
 */
export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Operação',
    items: [
      { label: 'Painel', href: '/admin', icon: LayoutDashboard, anyOf: [P.DASHBOARD_VIEW] },
      { label: 'Clientes', href: '/admin/customers', icon: Users, anyOf: [P.CUSTOMERS_VIEW] },
      { label: 'Motos', href: '/admin/motorcycles', icon: Bike, anyOf: [P.MOTORCYCLES_VIEW] },
      { label: 'Contratos', href: '/admin/contracts', icon: FileText, anyOf: [P.CONTRACTS_VIEW] },
      { label: 'Manutenção', href: '/admin/maintenance', icon: Wrench, anyOf: [P.MAINTENANCE_VIEW] },
      { label: 'Ocorrências e multas', href: '/admin/occurrences', icon: ShieldAlert, anyOf: [P.OCCURRENCES_VIEW] },
      { label: 'Documentos', href: '/admin/documents', icon: FolderOpen, anyOf: [P.DOCUMENTS_VIEW] },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { label: 'Pagamentos', href: '/admin/payments', icon: Receipt, anyOf: [P.PAYMENTS_VIEW] },
      { label: 'Inadimplência', href: '/admin/delinquency', icon: AlertTriangle, anyOf: [P.PAYMENTS_VIEW] },
      { label: 'Financeiro', href: '/admin/finance', icon: Wallet, anyOf: [P.FINANCE_VIEW] },
      { label: 'Relatórios', href: '/admin/reports', icon: BarChart3, anyOf: [P.REPORTS_VIEW] },
    ],
  },
  {
    label: 'Comunicação',
    items: [
      { label: 'Avisos aos clientes', href: '/admin/announcements', icon: Megaphone, anyOf: [P.NOTIFICATIONS_SEND] },
      { label: 'Suporte', href: '/admin/support', icon: LifeBuoy, anyOf: [P.SUPPORT_MANAGE] },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Rastreamento', href: '/admin/tracking', icon: MapPin, anyOf: [P.TRACKING_VIEW] },
      { label: 'Histórico', href: '/admin/audit', icon: History, anyOf: [P.AUDIT_VIEW] },
      { label: 'Configurações', href: '/admin/settings', icon: Settings, anyOf: [P.SETTINGS_MANAGE, P.USERS_MANAGE] },
    ],
  },
];

/** Barra inferior do celular: o que a proprietária mais abre na rua. */
export const ADMIN_MOBILE_TABS: NavItem[] = [
  { label: 'Painel', href: '/admin', icon: LayoutDashboard, anyOf: [P.DASHBOARD_VIEW] },
  { label: 'Clientes', href: '/admin/customers', icon: Users, anyOf: [P.CUSTOMERS_VIEW] },
  { label: 'Motos', href: '/admin/motorcycles', icon: Bike, anyOf: [P.MOTORCYCLES_VIEW] },
  { label: 'Pagamentos', href: '/admin/payments', icon: Receipt, anyOf: [P.PAYMENTS_VIEW] },
];

/** Títulos de telas fora do menu (perfil, notificações). */
export const ADMIN_EXTRA_TITLES: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/admin/notifications', label: 'Notificações', icon: ClipboardList },
  { href: '/admin/profile', label: 'Meu perfil', icon: Users },
];

export function visibleNav(permissions: readonly string[]): NavGroup[] {
  return ADMIN_NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.anyOf.some((p) => permissions.includes(p))),
  })).filter((g) => g.items.length > 0);
}

export function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function currentTitle(pathname: string): string {
  const all = [...ADMIN_NAV.flatMap((g) => g.items), ...ADMIN_EXTRA_TITLES];
  return (
    all
      .filter((i) => isActive(pathname, i.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? 'Locamania'
  );
}
