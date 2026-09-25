import { formatDateTime } from '@locamania/shared';

const dayFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

/** Instante curto e humano: "hoje, 08:00" · "ontem, 08:00" · "22/09/2026, 08:00". Fuso de São Paulo. */
export function shortWhen(iso: string): string {
  const d = new Date(iso);
  const day = dayFmt.format(d);
  if (day === dayFmt.format(new Date())) return `hoje, ${timeFmt.format(d)}`;
  if (day === dayFmt.format(new Date(Date.now() - 86_400_000))) return `ontem, ${timeFmt.format(d)}`;
  return formatDateTime(iso);
}
