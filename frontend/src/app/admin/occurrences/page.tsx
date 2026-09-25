'use client';

import { OCCURRENCE_TYPE_LABELS, OCCURRENCE_TYPES, Permission, type OccurrenceStatus, type OccurrenceType } from '@locamania/shared';
import { Plus } from 'lucide-react';
import Link from 'next/link';

import { OccurrenceList } from '@/components/occurrences/occurrence-list';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilterChips, SearchInput } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SelectMenu } from '@/components/ui/select-menu';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useOccurrences } from '@/lib/queries';
import { pageOf, useUrlState } from '@/lib/use-url-state';
import { plural } from '@/lib/utils';

type StatusFilter = 'all' | OccurrenceStatus;
const STATUS_FILTERS: StatusFilter[] = ['all', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'];
const STATUS_CHIP: Record<StatusFilter, string> = { all: 'Todas', OPEN: 'Abertas', IN_PROGRESS: 'Em andamento', RESOLVED: 'Resolvidas', CANCELLED: 'Canceladas' };

export default function OccurrencesPage() {
  const canManage = useCan(Permission.OCCURRENCES_MANAGE);
  const [q, setQ, ready] = useUrlState({ status: 'all', type: '', search: '', page: '1' });
  const status = (STATUS_FILTERS as string[]).includes(q.status) ? (q.status as StatusFilter) : 'all';
  const type = (OCCURRENCE_TYPES as string[]).includes(q.type) ? (q.type as OccurrenceType) : undefined;
  const { data, isLoading, error, isFetching } = useOccurrences(
    { status: status === 'all' ? undefined : status, type, search: q.search || undefined, page: pageOf(q.page), pageSize: 20 },
    ready,
  );
  // Contadores dos filtros que pedem ação (respeitam o tipo escolhido).
  const open = useOccurrences({ status: 'OPEN', type, pageSize: 1 }, ready);
  const progress = useOccurrences({ status: 'IN_PROGRESS', type, pageSize: 1 }, ready);

  const filtered = status !== 'all' || !!type || !!q.search;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ocorrências e multas"
        description={data ? plural(data.total, 'ocorrência', 'ocorrências') + (filtered ? ' neste filtro' : ' registradas') : 'Multas, acidentes, avarias, furtos e problemas das motos.'}
        actions={
          canManage && (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/admin/occurrences/new">
                <Plus /> Nova ocorrência
              </Link>
            </Button>
          )
        }
      />

      <div className="space-y-3">
        <FilterChips
          value={status}
          onChange={(v) => setQ({ status: v, page: '1' })}
          options={STATUS_FILTERS.map((s) => ({
            value: s,
            label: STATUS_CHIP[s],
            count: s === 'OPEN' ? open.data?.total : s === 'IN_PROGRESS' ? progress.data?.total : undefined,
            tone: s === 'OPEN' ? ('danger' as const) : s === 'IN_PROGRESS' ? ('warning' as const) : undefined,
          }))}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_1fr] lg:grid-cols-[220px_minmax(0,420px)]">
          <SelectMenu
            aria-label="Tipo de ocorrência"
            value={type ?? ''}
            onChange={(v) => setQ({ type: v, page: '1' })}
            placeholder="Todos os tipos"
            options={OCCURRENCE_TYPES.map((t) => ({ value: t, label: OCCURRENCE_TYPE_LABELS[t] }))}
          />
          <SearchInput value={q.search ?? ''} onChange={(v) => setQ({ search: v, page: '1' })} placeholder="Placa, cliente ou nº da multa" />
        </div>
      </div>

      <Card className={isFetching && !isLoading ? 'opacity-70 transition-opacity' : undefined}>
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : (
          <OccurrenceList
            rows={ready ? data?.data : undefined}
            loading={isLoading || !ready}
            empty={
              filtered
                ? { title: 'Nenhuma ocorrência neste filtro', description: 'Tente outra situação, outro tipo ou outra busca.' }
                : { title: 'Nenhuma ocorrência registrada', description: 'Multas, acidentes e avarias das motos aparecem aqui.' }
            }
          />
        )}
        {data && data.totalPages > 1 && (
          <div className="border-t border-border p-3">
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} unit="ocorrências" onPageChange={(p) => setQ({ page: String(p) })} />
          </div>
        )}
      </Card>
    </div>
  );
}
