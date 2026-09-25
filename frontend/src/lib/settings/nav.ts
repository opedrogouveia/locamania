import { Permission } from '@locamania/shared';
import {
  Building2,
  FileSignature,
  ListChecks,
  Plug,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface SettingsItem {
  href: string;
  label: string;
  /** Uma linha: o que se ajusta ali (a cliente não é técnica). */
  description: string;
  icon: LucideIcon;
  permission: Permission;
}

export interface SettingsGroup {
  label: string;
  items: SettingsItem[];
}

const P = Permission;

/**
 * Mapa das Configurações (§42). A página inicial, o menu lateral das subpáginas
 * e a guarda de permissão saem daqui — item novo aparece nos três lugares.
 */
export const SETTINGS_NAV: SettingsGroup[] = [
  {
    label: 'Empresa',
    items: [
      { href: '/admin/settings/company', label: 'Dados da empresa', description: 'Nome, CNPJ, contatos, endereço e PIX.', icon: Building2, permission: P.SETTINGS_MANAGE },
      { href: '/admin/settings/contract-template', label: 'Modelo de contrato', description: 'O texto de todo contrato novo.', icon: FileSignature, permission: P.SETTINGS_MANAGE },
    ],
  },
  {
    label: 'Regras do negócio',
    items: [
      { href: '/admin/settings/parameters', label: 'Regras e avisos', description: 'Multa, juros, lembretes e bloqueio.', icon: SlidersHorizontal, permission: P.SETTINGS_MANAGE },
      { href: '/admin/settings/maintenance-types', label: 'Tipos de manutenção', description: 'Óleo, revisão, pneus e intervalos.', icon: Wrench, permission: P.SETTINGS_MANAGE },
      { href: '/admin/settings/catalogs', label: 'Listas de opções', description: 'Marcas, modelos e categorias.', icon: ListChecks, permission: P.SETTINGS_MANAGE },
    ],
  },
  {
    label: 'Equipe e acesso',
    items: [
      { href: '/admin/settings/users', label: 'Usuários', description: 'Equipe, perfis e senhas.', icon: Users, permission: P.USERS_MANAGE },
      { href: '/admin/settings/permissions', label: 'Permissões', description: 'O que cada perfil pode fazer.', icon: ShieldCheck, permission: P.USERS_MANAGE },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/admin/settings/integrations', label: 'Integrações', description: 'PIX, WhatsApp, e-mail e rastreador.', icon: Plug, permission: P.SETTINGS_MANAGE },
      { href: '/admin/settings/system', label: 'Rotinas e backup', description: 'Avisos diários e cópia de segurança.', icon: ServerCog, permission: P.SETTINGS_MANAGE },
    ],
  },
];

export function visibleSettings(permissions: readonly string[]): SettingsGroup[] {
  return SETTINGS_NAV.map((g) => ({ ...g, items: g.items.filter((i) => permissions.includes(i.permission)) })).filter((g) => g.items.length > 0);
}

export function settingsItemFor(pathname: string): SettingsItem | undefined {
  return SETTINGS_NAV.flatMap((g) => g.items).find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
}
