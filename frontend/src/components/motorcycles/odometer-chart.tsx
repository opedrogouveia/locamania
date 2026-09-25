'use client';

import { ODOMETER_SOURCE_LABELS, type OdometerReadingDto } from '@locamania/shared';
import { useMemo, useState } from 'react';

import { useWidth } from '@/components/charts/use-width';
import { cn, formatDateTime, formatKm } from '@/lib/utils';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Faixa "redonda" do eixo Y entre o menor e o maior km (odômetro não começa no zero). */
function niceRange(min: number, max: number, count = 4): number[] {
  const span = Math.max(max - min, 1);
  const rough = span / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? rough;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return ticks;
}

const axisKm = (v: number) =>
  v >= 1000
    ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
    : v.toLocaleString('pt-BR');

/**
 * Evolução da quilometragem (skill dataviz): uma série, linha de 2 px com
 * lavagem de 10%, grade em linha fina, rótulo só no fim, cruz que segue o
 * ponteiro (mouse, toque e setas do teclado). Cor pelo token `--chart-1`.
 * A tabela logo abaixo é a versão em texto de todos os pontos.
 */
export function OdometerChart({
  readings,
  height = 200,
}: {
  readings: OdometerReadingDto[];
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const points = useMemo(
    () =>
      [...readings]
        .map((r) => ({ ...r, t: new Date(r.readAt).getTime() }))
        .sort((a, b) => a.t - b.t),
    [readings],
  );

  if (points.length < 2) return null;

  const axisW = 52;
  const padTop = 24;
  const padBottom = 24;
  const padRight = 12;
  const plotW = Math.max(0, width - axisW - padRight);
  const plotH = height - padTop - padBottom;
  const t0 = points[0]!.t;
  const t1 = points[points.length - 1]!.t;
  const ticks = niceRange(points[0]!.km, points[points.length - 1]!.km);
  const lo = ticks[0]!;
  const hi = ticks[ticks.length - 1]!;
  const x = (t: number) => axisW + ((t - t0) / Math.max(t1 - t0, 1)) * plotW;
  const y = (km: number) => padTop + plotH - ((km - lo) / Math.max(hi - lo, 1)) * plotH;

  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.km).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(t1).toFixed(1)},${padTop + plotH} L${x(t0).toFixed(1)},${padTop + plotH} Z`;

  // Marcas de mês no eixo X (pula meses quando a tela é estreita).
  const months: { t: number; label: string }[] = [];
  const d = new Date(t0);
  let cursor = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  while (cursor <= t1) {
    const c = new Date(cursor);
    months.push({ t: cursor, label: MONTHS[c.getMonth()]! });
    cursor = new Date(c.getFullYear(), c.getMonth() + 1, 1).getTime();
  }
  const monthEvery = Math.max(1, Math.ceil((months.length * 36) / Math.max(plotW, 1)));

  const last = points[points.length - 1]!;
  const hovered = active !== null ? points[active] : null;

  function nearest(clientX: number, rect: DOMRect) {
    const px = clientX - rect.left;
    let best = 0;
    let dist = Infinity;
    points.forEach((p, i) => {
      const dd = Math.abs(x(p.t) - px);
      if (dd < dist) {
        dist = dd;
        best = i;
      }
    });
    setActive(best);
  }

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Quilometragem de ${formatKm(points[0]!.km)} a ${formatKm(last.km)} entre ${formatDateTime(points[0]!.readAt).slice(0, 10)} e ${formatDateTime(last.readAt).slice(0, 10)}`}
          tabIndex={0}
          className="block overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onPointerMove={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerDown={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight')
              setActive((i) => Math.min((i ?? -1) + 1, points.length - 1));
            else if (e.key === 'ArrowLeft') setActive((i) => Math.max((i ?? points.length) - 1, 0));
            else if (e.key === 'Escape') setActive(null);
          }}
        >
          {ticks.map((tk) => (
            <g key={tk}>
              <line
                x1={axisW}
                x2={width - padRight}
                y1={y(tk)}
                y2={y(tk)}
                className="stroke-border"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={axisW - 8}
                y={y(tk)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted-foreground text-[11px] tabular"
              >
                {axisKm(tk)}
              </text>
            </g>
          ))}
          {months.map(
            (m, i) =>
              i % monthEvery === 0 && (
                <text
                  key={m.t}
                  x={x(m.t)}
                  y={height - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px]"
                >
                  {m.label}
                </text>
              ),
          )}
          <path d={area} className="fill-chart-1" opacity={0.1} />
          <path
            d={line}
            className="stroke-chart-1"
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Fim da linha: ponto com anel da cor da superfície e o valor atual. */}
          <circle
            cx={x(last.t)}
            cy={y(last.km)}
            r={4}
            className="fill-chart-1 stroke-card"
            strokeWidth={2}
          />
          {active === null && (
            <text
              x={x(last.t) - 8}
              y={y(last.km) - 10}
              textAnchor="end"
              className="fill-foreground text-[12px] font-medium tabular"
            >
              {formatKm(last.km)}
            </text>
          )}
          {hovered && (
            <g aria-hidden>
              <line
                x1={x(hovered.t)}
                x2={x(hovered.t)}
                y1={padTop}
                y2={padTop + plotH}
                className="stroke-muted-foreground/50"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <circle
                cx={x(hovered.t)}
                cy={y(hovered.km)}
                r={5}
                className="fill-chart-1 stroke-card"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
      )}
      {hovered && (
        <div
          className={cn(
            'pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md',
          )}
          style={{ left: Math.min(Math.max(x(hovered.t), 90), width - 90) }}
          role="status"
        >
          <p className="whitespace-nowrap text-sm font-semibold tabular">{formatKm(hovered.km)}</p>
          <p className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTime(hovered.readAt)} · {ODOMETER_SOURCE_LABELS[hovered.source]}
          </p>
        </div>
      )}
    </div>
  );
}
