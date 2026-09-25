'use client';

import { Permission, type ContractStatus } from '@locamania/shared';
import { Plus } from 'lucide-react';
import Link from 'next/link';

import { ContractList, ENDING_DAYS } from '@/components/contracts/contract-list';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilterChips, SearchInput, Toolbar } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useContracts } from '@/lib/queries';
import { pageOf, useUrlState } from '@/lib/use-url-state';

type Filter = 'all' | ContractStatus | 'ending';

const FILTER_LABEL: Record<Filter, string> = {
  all: 'Todos',
  ACTIVE: 'Ativos',
  ending: 'Terminando',
  DRAFT: 'Rascunhos',
  ENDED: 'Encerrados',
  CANCELLED: 'Cancelados',
};
const FILTERS: Filter[] = ['all', 'ACTIVE', 'ending', 'DRAFT', 'ENDED', 'CANCELLED'];

const EMPTY: Record<Filter, { title: string; description?: string }> = {
  all: {
    title: 'Nenhum contrato ainda',
    description: 'Os aluguéis aparecem aqui assim que forem criados.',
  },
  ACTIVE: { title: 'Nenhum contrato ativo' },
  ending: {
    title: 'Nenhum contrato terminando',
    description: `Nenhum aluguel ativo termina nos próximos ${ENDING_DAYS} dias.`,
  },
  DRAFT: {
    title: 'Nenhum rascunho',
    description: 'Contratos aguardando assinatura ou entrega da moto aparecem aqui.',
  },
  ENDED: { title: 'Nenhum contrato encerrado' },
  CANCELLED: { title: 'Nenhum contrato cancelado' },
};

export default function ContractsPage() {
  const canManage = useCan(Permission.CONTRACTS_MANAGE);
  const [q, setQ, ready] = useUrlState({ status: 'all', ending: '', search: '', page: '1' });
  // O painel manda `?ending=1` ("Contratos terminando").
  const filter: Filter = q.ending ? 'ending' : (q.status as Filter);
  const query = {
    search: q.search || undefined,
    page: pageOf(q.page),
    pageSize: 20,
    status: filter !== 'all' && filter !== 'ending' ? filter : undefined,
    endingWithinDays: filter === 'ending' ? ENDING_DAYS : undefined,
  };
  const { data, isLoading, error, isFetching } = useContracts(query, ready);
  // Contadores só do que pede ação (rascunho parado, contrato acabando).
  const drafts = useContracts({ status: 'DRAFT', pageSize: 1 }, ready);
  const ending = useContracts({ endingWithinDays: ENDING_DAYS, pageSize: 1 }, ready);

  const empty = q.search
    ? {
        title: 'Nenhum contrato encontrado',
        description: 'Tente o número do contrato, o nome do cliente ou a placa.',
      }
    : EMPTY[filter];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contratos"
        description={
          data
            ? `${data.total.toLocaleString('pt-BR')} ${data.total === 1 ? 'contrato' : 'contratos'}${filter !== 'all' ? ` · ${FILTER_LABEL[filter].toLowerCase()}` : ''}`
            : 'Aluguéis: assinatura, entrega, cronograma e devolução.'
        }
        actions={
          canManage && (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/admin/contracts/new">
                <Plus /> Nova locação
              </Link>
            </Button>
          )
        }
      />
      <Toolbar>
        <FilterChips
          value={filter}
          onChange={(v) =>
            setQ({
              status: v === 'ending' ? 'all' : v,
              ending: v === 'ending' ? '1' : '',
              page: '1',
            })
          }
          options={FILTERS.map((f) => ({
            value: f,
            label: FILTER_LABEL[f],
            count:
              f === 'DRAFT'
                ? drafts.data?.total || undefined
                : f === 'ending'
                  ? ending.data?.total || undefined
                  : undefined,
            tone: f === 'ending' ? 'warning' : f === 'DRAFT' ? 'default' : undefined,
          }))}
        />
        <SearchInput
          value={q.search ?? ''}
          onChange={(v) => setQ({ search: v, page: '1' })}
          placeholder="Nº do contrato, cliente ou placa"
          className="lg:w-80"
        />
      </Toolbar>
      <Card className={isFetching && !isLoading ? 'opacity-70 transition-opacity' : undefined}>
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : (
          <ContractList
            rows={ready ? data?.data : undefined}
            loading={isLoading || !ready}
            empty={{
              ...empty,
              action:
                canManage && filter === 'all' && !q.search ? (
                  <Button asChild>
                    <Link href="/admin/contracts/new">
                      <Plus /> Nova locação
                    </Link>
                  </Button>
                ) : undefined,
            }}
          />
        )}
        {data && data.totalPages > 1 && (
          <div className="border-t border-border p-3">
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              unit="contratos"
              onPageChange={(p) => setQ({ page: String(p) })}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
