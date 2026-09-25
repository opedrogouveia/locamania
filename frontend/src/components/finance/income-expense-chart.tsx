'use client';

import { useState } from 'react';

import { niceTicks, useWidth } from '@/components/charts/use-width';
import { cn } from '@/lib/utils';

export interface IncomeExpenseDatum {
  key: string;
  /** Rótulo curto do eixo X. */
  label: string;
  /** Título do tooltip ("Semana de 01/09"). */
  title: string;
  income: number;
  expense: number;
  /** Período ainda em andamento (desenhado mais claro). */
  partial?: boolean;
}

/** Largura mínima de cada grupo (duas colunas + folga) antes de agrupar períodos vizinhos. */
const MIN_BAND = 20;

/**
 * Junta períodos vizinhos quando a tela é estreita (31 dias num celular viram
 * ~8 grupos): cada coluna continua legível e nenhum valor some — a soma fica
 * no grupo e o tooltip diz o intervalo.
 */
function regroup(data: IncomeExpenseDatum[], plotWidth: number): IncomeExpenseDatum[] {
  if (!data.length || plotWidth <= 0) return data;
  const k = Math.ceil((MIN_BAND * data.length) / plotWidth);
  if (k <= 1) return data;
  const out: IncomeExpenseDatum[] = [];
  for (let i = 0; i < data.length; i += k) {
    const chunk = data.slice(i, i + k);
    const first = chunk[0]!;
    const last = chunk[chunk.length - 1]!;
    out.push({
      key: first.key,
      label: first.label,
      title: chunk.length > 1 ? `${first.label} a ${last.label}` : first.title,
      income: chunk.reduce((a, d) => a + d.income, 0),
      expense: chunk.reduce((a, d) => a + d.expense, 0),
      partial: chunk.some((d) => d.partial),
    });
  }
  return out;
}

/**
 * Entradas × saídas por período (skill dataviz): duas colunas por período
 * (chart-1 = entradas, chart-3 = saídas — par validado para daltonismo nos dois
 * temas), 2 px de superfície entre elas, topo arredondado de 4 px e base reta,
 * um eixo só, grade em linha fina, tooltip por período (mouse, toque e
 * teclado). A legenda fica com a tela, que também oferece a tabela.
 */
export function IncomeExpenseChart({
  data,
  format,
  formatAxis,
  height = 240,
  ariaLabel,
  className,
}: {
  data: IncomeExpenseDatum[];
  format: (v: number) => string;
  formatAxis: (v: number) => string;
  height?: number;
  ariaLabel: string;
  className?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const axisW = 48;
  const padTop = 12;
  const padBottom = 24;
  const plotW = Math.max(0, width - axisW);
  const plotH = height - padTop - padBottom;
  const rows = regroup(data, plotW);
  const ticks = niceTicks(Math.max(...rows.map((d) => Math.max(d.income, d.expense)), 0));
  const top = ticks[ticks.length - 1] || 1;
  const band = rows.length ? plotW / rows.length : 0;
  const gap = 2;
  const barW = Math.max(3, Math.min(16, (band * 0.72 - gap) / 2));
  const groupW = barW * 2 + gap;
  const y = (v: number) => padTop + plotH - (v / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(40 / Math.max(band, 1)));

  function barPath(x: number, v: number) {
    const h = Math.max(0, (v / top) * plotH);
    if (h <= 0) return '';
    const r = Math.min(4, h, barW / 2);
    const yTop = padTop + plotH - h;
    const yBase = padTop + plotH;
    return `M${x},${yBase} L${x},${yTop + r} Q${x},${yTop} ${x + r},${yTop} L${x + barW - r},${yTop} Q${x + barW},${yTop} ${x + barW},${yTop + r} L${x + barW},${yBase} Z`;
  }

  const hovered = active !== null ? rows[active] : null;
  const tipLeft = active !== null ? axisW + band * active + band / 2 : 0;

  return (
    <div ref={ref} className={cn('relative w-full select-none', className)} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={axisW} x2={width} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={axisW - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular">
                {formatAxis(t)}
              </text>
            </g>
          ))}
          {rows.map((d, i) => {
            const x = axisW + band * i + (band - groupW) / 2;
            const dim = active !== null && active !== i;
            return (
              <g key={d.key} className={cn('transition-opacity', dim && 'opacity-50', d.partial && !dim && 'opacity-60')}>
                <path d={barPath(x, d.income)} className="fill-chart-1" />
                <path d={barPath(x + barW + gap, d.expense)} className="fill-chart-3" />
                {(rows.length - 1 - i) % labelEvery === 0 && (
                  <text x={x + groupW / 2} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular">
                    {d.label}
                  </text>
                )}
                {/* Área de toque: a faixa inteira do período. */}
                <rect
                  x={axisW + band * i}
                  y={padTop}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.title}: entradas ${format(d.income)}, saídas ${format(d.expense)}${d.partial ? ' (em andamento)' : ''}`}
                  className="cursor-pointer outline-none"
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onPointerDown={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {hovered && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md"
          style={{ left: Math.min(Math.max(tipLeft, 96), width - 96) }}
          role="status"
        >
          <p className="whitespace-nowrap text-xs font-medium text-muted-foreground">
            {hovered.title}
            {hovered.partial && ' · em andamento'}
          </p>
          <dl className="mt-1 space-y-0.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-[3px] bg-chart-1" aria-hidden />
              <dt className="text-muted-foreground">Entradas</dt>
              <dd className="ml-auto pl-4 font-semibold tabular">{format(hovered.income)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-[3px] bg-chart-3" aria-hidden />
              <dt className="text-muted-foreground">Saídas</dt>
              <dd className="ml-auto pl-4 font-semibold tabular">{format(hovered.expense)}</dd>
            </div>
            <div className="flex items-center gap-2 border-t border-border pt-1">
              <span className="size-2.5" aria-hidden />
              <dt className="text-muted-foreground">Saldo</dt>
              <dd className={cn('ml-auto pl-4 font-semibold tabular', hovered.income - hovered.expense < 0 && 'text-destructive')}>{format(hovered.income - hovered.expense)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
