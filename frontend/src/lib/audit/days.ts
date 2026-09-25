import { addDays, formatYmd, instantToYmd, type Ymd } from '@locamania/shared';

const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' });

/** "Hoje", "Ontem" ou "quinta-feira, 24/09/2026" — cabeçalho de grupo por dia. */
export function dayHeading(day: Ymd, today: Ymd): string {
  if (day === today) return 'Hoje';
  if (day === addDays(today, -1)) return 'Ontem';
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const weekday = WEEKDAY.format(new Date(Date.UTC(y, m - 1, d)));
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${formatYmd(day)}`;
}

/** Agrupa itens (já ordenados do mais novo) pelo dia, no fuso da empresa. */
export function groupByDay<T>(items: T[], at: (item: T) => string): { day: Ymd; items: T[] }[] {
  const groups: { day: Ymd; items: T[] }[] = [];
  for (const item of items) {
    const day = instantToYmd(at(item));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}
