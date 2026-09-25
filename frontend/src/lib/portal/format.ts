import { diffDays, formatYmd, type PortalChargeDto, type Ymd } from '@locamania/shared';

/**
 * Textos curtos do app do cliente. O locatário lê na rua, com pressa: "Vence
 * amanhã" diz mais que "26/09/2026".
 */

/** "Aluguel semana 11 — LOC-2026-0058" → "Aluguel semana 11" (o nº do contrato é ruído para o cliente). */
export function chargeTitle(c: Pick<PortalChargeDto, 'description'>): string {
  return c.description.split(' — ')[0]?.trim() || c.description;
}

/** "Vence hoje", "Vence amanhã", "Vence em 3 dias", "Venceu há 2 dias". */
export function dueText(dueDate: Ymd, today: Ymd): string {
  const diff = diffDays(today, dueDate);
  if (diff === 0) return 'Vence hoje';
  if (diff === 1) return 'Vence amanhã';
  if (diff > 1 && diff <= 6) return `Vence em ${diff} dias`;
  if (diff > 6) return `Vence em ${formatYmd(dueDate)}`;
  if (diff === -1) return 'Venceu ontem';
  return `Venceu há ${-diff} dias`;
}

/** Linha completa sem repetir a data: "Vence amanhã · 26/09/2026", "Vence em 03/10/2026". */
export function dueLine(dueDate: Ymd, today: Ymd): string {
  const diff = diffDays(today, dueDate);
  const text = dueText(dueDate, today);
  return diff > 6 ? text : `${text} · ${formatYmd(dueDate)}`;
}

/** Dias de atraso (0 se não venceu). */
export function daysLate(dueDate: Ymd, today: Ymd): number {
  return Math.max(0, diffDays(dueDate, today));
}

/** Instante → "agora", "há 5 min", "há 2 h", "ontem", "há 3 dias", "12/08/2026". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.round((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(then);
}

/** Instante → "14:32" no fuso da empresa. */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}

/** Instante → "25/09/2026" no fuso da empresa. */
export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}

/** Saudação pela hora de São Paulo. */
export function greeting(now: Date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(now));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
