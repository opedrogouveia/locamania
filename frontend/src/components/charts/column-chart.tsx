'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import { niceTicks, useWidth } from './use-width';

export interface ColumnDatum {
  key: string;
  /** Rótulo do eixo X (curto). */
  label: string;
  /** Título do tooltip (mais descritivo). */
  title: string;
  value: number;
  /** Período ainda em andamento: desenhado mais claro, avisado no tooltip. */
  partial?: boolean;
}

/**
 * Colunas de uma série só (skill dataviz): colunas ≤ 24 px com topo arredondado
 * de 4 px e base reta, grade em linha fina, rótulo só no maior valor, tooltip
 * por coluna (mouse, toque e teclado). A cor vem do token `--chart-1`.
 */
export function ColumnChart({
  data,
  format,
  formatAxis,
  height = 220,
  className,
  ariaLabel,
}: {
  data: ColumnDatum[];
  format: (v: number) => string;
  formatAxis: (v: number) => string;
  height?: number;
  className?: string;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const ticks = niceTicks(Math.max(...data.map((d) => d.value), 0));
  const top = ticks[ticks.length - 1] || 1;
  const axisW = 44;
  const padTop = 22;
  const padBottom = 24;
  const plotW = Math.max(0, width - axisW);
  const plotH = height - padTop - padBottom;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(6, Math.min(24, band * 0.56));
  const y = (v: number) => padTop + plotH - (v / top) * plotH;
  const maxIdx = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);
  const labelEvery = band < 34 ? 2 : 1;

  function barPath(x: number, v: number) {
    const h = Math.max(0, (v / top) * plotH);
    const r = Math.min(4, h, barW / 2);
    const yTop = padTop + plotH - h;
    const yBase = padTop + plotH;
    return `M${x},${yBase} L${x},${yTop + r} Q${x},${yTop} ${x + r},${yTop} L${x + barW - r},${yTop} Q${x + barW},${yTop} ${x + barW},${yTop + r} L${x + barW},${yBase} Z`;
  }

  const hovered = active !== null ? data[active] : null;
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
          {data.map((d, i) => {
            const x = axisW + band * i + (band - barW) / 2;
            const isActive = active === i;
            return (
              <g key={d.key}>
                <path
                  d={barPath(x, d.value)}
                  className={cn('fill-chart-1 transition-opacity', d.partial && 'opacity-45', active !== null && !isActive && 'opacity-60')}
                />
                {i === maxIdx && d.value > 0 && (
                  <text x={x + barW / 2} y={y(d.value) - 6} textAnchor="middle" className="fill-foreground text-[11px] font-medium tabular">
                    {formatAxis(d.value)}
                  </text>
                )}
                {i % labelEvery === (data.length - 1) % labelEvery && (
                  <text x={x + barW / 2} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular">
                    {d.label}
                  </text>
                )}
                {/* Área de toque: a faixa inteira, maior que a coluna. */}
                <rect
                  x={axisW + band * i}
                  y={padTop}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.title}: ${format(d.value)}${d.partial ? ' (parcial)' : ''}`}
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
          style={{ left: Math.min(Math.max(tipLeft, 80), width - 80) }}
          role="status"
        >
          <p className="whitespace-nowrap text-sm font-semibold tabular">{format(hovered.value)}</p>
          <p className="whitespace-nowrap text-xs text-muted-foreground">
            {hovered.title}
            {hovered.partial && ' · em andamento'}
          </p>
        </div>
      )}
    </div>
  );
}
