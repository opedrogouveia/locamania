import type { Prisma } from '@prisma/client';
import { dateToYmd, ymdToDate, type MoneyString, type Ymd } from '@locamania/shared';

/**
 * Conversões na borda banco ↔ API, num lugar só:
 * - `@db.Date` (Date UTC meia-noite) ↔ `YYYY-MM-DD`;
 * - `Decimal` ↔ string com 2 casas;
 * - instantes ↔ ISO.
 */

export function ymd(date: Date): Ymd;
export function ymd(date: Date | null | undefined): Ymd | null;
export function ymd(date: Date | null | undefined): Ymd | null {
  return date ? dateToYmd(date) : null;
}

export function dbDate(value: Ymd): Date;
export function dbDate(value: Ymd | null | undefined): Date | null;
export function dbDate(value: Ymd | null | undefined): Date | null {
  return value ? ymdToDate(value) : null;
}

export function iso(date: Date): string;
export function iso(date: Date | null | undefined): string | null;
export function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

export function money(value: Prisma.Decimal): MoneyString;
export function money(value: Prisma.Decimal | null | undefined): MoneyString | null;
export function money(value: Prisma.Decimal | null | undefined): MoneyString | null {
  return value === null || value === undefined ? null : value.toFixed(2);
}

/** Aceita número ou string ("350", "350,00") e devolve string decimal para o Prisma. */
export function toDecimalInput(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value.toFixed(2);
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
  const n = Number(normalized);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

/** Remove chaves `undefined` (PATCH parcial: só o que veio muda). */
export function definedOnly<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
