'use client';

import type { ReportTableDto } from '@locamania/shared';
import { Table2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { MobileRow } from '@/components/ui/kit';

type Section = ReportTableDto['sections'][number];
type Row = Section['rows'][number] & { __i: number };

/** Ano sai como "2024", não "2.024"; os demais números com separador de milhar. */
const text = (v: string | number | null | undefined, key = '') =>
  v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? (/year/i.test(key) ? String(v) : v.toLocaleString('pt-BR')) : v;

/**
 * Uma seção do relatório: tabela no computador, cartões no celular (primeira
 * coluna vira título, segunda o subtítulo, a última numérica fica à direita e
 * o resto em "rótulo: valor"). Lista longa começa curta, com "mostrar todas".
 */
export function ReportTable({ section, initial = 15 }: { section: Section; initial?: number }) {
  const [all, setAll] = useState(false);
  const rows: Row[] = section.rows.map((r, i) => ({ ...r, __i: i }));
  const shown = all ? rows : rows.slice(0, initial);
  const cols = section.columns;
  // Cartão do celular: 1ª coluna é o título; a 2ª vira subtítulo só se for texto
  // (número sem rótulo confunde); a última numérica vai à direita, com rótulo.
  const [first, ...others] = cols;
  const second = others[0] && others[0].align !== 'right' ? others[0] : undefined;
  const rest = second ? others.slice(1) : others;
  const rightCol = [...rest].reverse().find((c) => c.align === 'right');
  const metaCols = rest.filter((c) => c !== rightCol);

  const columns: Column<Row>[] = cols.map((c, i) => ({
    key: c.key,
    header: c.label,
    align: c.align === 'right' ? 'right' : 'left',
    className: i === 0 ? 'font-medium' : c.align === 'right' ? 'whitespace-nowrap' : undefined,
    cell: (r) => text(r[c.key], c.key),
  }));

  return (
    <div>
      <DataTable
        rows={shown}
        columns={columns}
        rowKey={(r) => String(r.__i)}
        empty={{ icon: Table2, title: 'Nada neste período', description: 'Tente outro período.' }}
        mobileCard={(r) => (
          <MobileRow
            wrapTitle
            title={first ? text(r[first.key], first.key) : ''}
            subtitle={second ? text(r[second.key], second.key) : undefined}
            meta={metaCols.map((c) => (
              <span key={c.key}>
                {c.label}: <span className="text-foreground">{text(r[c.key], c.key)}</span>
              </span>
            ))}
            right={
              rightCol ? (
                <>
                  <span className="text-[11px] text-muted-foreground">{rightCol.label}</span>
                  <span className="text-sm font-semibold tabular">{text(r[rightCol.key], rightCol.key)}</span>
                </>
              ) : undefined
            }
          />
        )}
      />
      {rows.length > initial && (
        <div className="border-t border-border p-2">
          <Button variant="ghost" className="w-full" onClick={() => setAll((v) => !v)}>
            {all ? 'Mostrar menos' : `Mostrar todas as ${rows.length.toLocaleString('pt-BR')} linhas`}
          </Button>
        </div>
      )}
    </div>
  );
}
