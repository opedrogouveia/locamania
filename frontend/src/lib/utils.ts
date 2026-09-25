import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combina classes Tailwind resolvendo conflitos (padrão shadcn/ui). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Formatação: um lugar só, vinda do shared (backend e frontend formatam igual).
export {
  formatBRL,
  formatKm,
  formatPercent,
  formatYmd,
  formatYmdShort,
  formatYmdLong,
  formatDateTime,
  formatCpf,
  formatCnpj,
  formatCep,
  formatPhone,
  formatPlate,
  maskCpf,
  relativeDays,
  firstName,
  initials,
  whatsappLink,
} from '@locamania/shared';

/** "hoje" no fuso da empresa, no navegador. */
export { todayYmd } from '@locamania/shared';

/** Bytes → "1,2 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

/** Plural simples: plural(3, 'moto', 'motos') → "3 motos". */
export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;
}
