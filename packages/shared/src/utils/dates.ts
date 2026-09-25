/**
 * Datas "só dia" (vencimentos, início/fim de contrato, validade de documento)
 * trafegam e são calculadas como string `YYYY-MM-DD`.
 *
 * Por quê: um `Date` carrega hora e fuso. Um vencimento "10/10" gravado como
 * meia-noite UTC vira 09/10 às 21h em São Paulo — e a cobrança mostraria o dia
 * errado. Com `YYYY-MM-DD` o dia é o dia, em qualquer fuso; "hoje" é calculado
 * no fuso da empresa (APP_TIMEZONE).
 */

export type Ymd = string;

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(value: unknown): value is Ymd {
  if (typeof value !== 'string' || !YMD_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Dia de hoje no fuso informado (padrão: America/Sao_Paulo). */
export function todayYmd(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): Ymd {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Converte um instante para o dia correspondente no fuso. */
export function instantToYmd(instant: Date | string, timeZone: string = DEFAULT_TIMEZONE): Ymd {
  return todayYmd(timeZone, typeof instant === 'string' ? new Date(instant) : instant);
}

function toUtc(ymd: Ymd): Date {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): Ymd {
  return date.toISOString().slice(0, 10);
}

export function addDays(ymd: Ymd, days: number): Ymd {
  const date = toUtc(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** Último dia do mês (1–12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Soma meses mantendo o dia-âncora; se o mês não tem esse dia, usa o último
 * (31/01 + 1 mês = 28/02 ou 29/02; + 2 meses = 31/03).
 */
export function addMonths(ymd: Ymd, months: number, anchorDay?: number): Ymd {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const day = anchorDay ?? d;
  const totalMonths = y * 12 + (m - 1) + months;
  const ny = Math.floor(totalMonths / 12);
  const nm = (totalMonths % 12) + 1;
  const nd = Math.min(day, daysInMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/** Dias de `from` até `to` (positivo se `to` é depois). */
export function diffDays(from: Ymd, to: Ymd): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

export function compareYmd(a: Ymd, b: Ymd): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minYmd(a: Ymd, b: Ymd): Ymd {
  return a <= b ? a : b;
}

export function maxYmd(a: Ymd, b: Ymd): Ymd {
  return a >= b ? a : b;
}

/** Dia da semana (0 = domingo). */
export function weekday(ymd: Ymd): number {
  return toUtc(ymd).getUTCDay();
}

/** Início da semana (segunda-feira) que contém o dia. */
export function startOfWeek(ymd: Ymd): Ymd {
  const wd = weekday(ymd);
  return addDays(ymd, wd === 0 ? -6 : 1 - wd);
}

export function startOfMonth(ymd: Ymd): Ymd {
  return `${ymd.slice(0, 7)}-01`;
}

export function endOfMonth(ymd: Ymd): Ymd {
  const [y, m] = ymd.split('-').map(Number) as [number, number];
  return `${ymd.slice(0, 7)}-${String(daysInMonth(y, m)).padStart(2, '0')}`;
}

/** Data (Date UTC meia-noite) para campos `@db.Date` do Prisma. */
export function ymdToDate(ymd: Ymd): Date {
  return toUtc(ymd);
}

/** Campo `@db.Date` do Prisma (UTC meia-noite) para `YYYY-MM-DD`. */
export function dateToYmd(date: Date): Ymd {
  return fromUtc(date);
}

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** `2026-10-15` → `15/10/2026`. */
export function formatYmd(ymd: Ymd | null | undefined): string {
  if (!ymd || !isYmd(ymd)) return '—';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

/** `2026-10-15` → `15/10`. */
export function formatYmdShort(ymd: Ymd | null | undefined): string {
  if (!ymd || !isYmd(ymd)) return '—';
  const [, m, d] = ymd.split('-');
  return `${d}/${m}`;
}

/** `2026-10-15` → `15 out 2026`. */
export function formatYmdLong(ymd: Ymd | null | undefined): string {
  if (!ymd || !isYmd(ymd)) return '—';
  const [y, m, d] = ymd.split('-');
  return `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]} ${y}`;
}

/** Instante ISO → `15/10/2026 14:32` no fuso da empresa. */
export function formatDateTime(
  iso: string | Date | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  if (!iso) return '—';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** "hoje", "amanhã", "em 3 dias", "há 2 dias" — relativo a hoje. */
export function relativeDays(ymd: Ymd, today: Ymd): string {
  const diff = diffDays(today, ymd);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  if (diff === -1) return 'ontem';
  if (diff > 1) return `em ${diff} dias`;
  return `há ${-diff} dias`;
}

/** Idade em anos completos numa data. */
export function ageOn(birthDate: Ymd, on: Ymd): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [y, m, d] = on.split('-').map(Number) as [number, number, number];
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}
