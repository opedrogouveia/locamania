/**
 * Dinheiro trafega na API como **string decimal** (`"1250.00"`), preservando a
 * precisão do `Decimal(12,2)` do banco. As contas são feitas em **centavos
 * inteiros** — somar floats (0.1 + 0.2) erra centavo, e erro de centavo em
 * cobrança vira reclamação de cliente.
 */

export type MoneyString = string;

/** Aceita `"1250.00"`, `"1250,50"`, `1250.5`, `"R$ 1.250,50"`. */
export function toCents(value: MoneyString | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Math.round(value * 100);
  let text = value.replace(/[R$\s]/g, '');
  if (text.includes(',')) {
    // Formato brasileiro: ponto é milhar, vírgula é decimal.
    text = text.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(text);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function fromCents(cents: number): MoneyString {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function sumMoney(...values: Array<MoneyString | number | null | undefined>): MoneyString {
  return fromCents(values.reduce<number>((acc, v) => acc + toCents(v), 0));
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** `"1250.5"` → `R$ 1.250,50`. Vazio/nulo vira travessão. */
export function formatBRL(value: MoneyString | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return BRL.format(toCents(value) / 100);
}

/** Percentual `2.5` → `2,5%`. */
export function formatPercent(value: number | string | null | undefined, digits = 2): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`;
}

/** Quilometragem `12700` → `12.700 km`. */
export function formatKm(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('pt-BR')} km`;
}
