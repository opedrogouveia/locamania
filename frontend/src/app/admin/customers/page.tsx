'use client';

import { CUSTOMER_STATUS_LABELS, Permission, formatCpf, formatPhone, formatPlate, type CustomerListItemDto, type CustomerStatus } from '@locamania/shared';
import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { FilterChips, MobileRow, SearchInput, Toolbar } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { CustomerStatusBadge, ExpiryBadge } from '@/components/ui/status-badge';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useCustomers } from '@/lib/queries';
import { pageOf, useUrlState } from '@/lib/use-url-state';
import { formatBRL } from '@/lib/utils';

type Filter = 'all' | CustomerStatus | 'collection';
const FILTERS: Filter[] = ['all', 'ACTIVE', 'OVERDUE', 'collection', 'BLOCKED', 'CONTRACT_ENDED', 'INACTIVE'];
const FILTER_LABEL = (f: Filter) => (f === 'all' ? 'Todos' : f === 'collection' ? 'Em cobrança' : CUSTOMER_STATUS_LABELS[f]);

export default function CustomersPage() {
  const router = useRouter();
  const canManage = useCan(Permission.CUSTOMERS_MANAGE);
  const [q, setQ, ready] = useUrlState({ status: 'all', search: '', page: '1' });
  const filter = q.status as Filter;
  const query = {
    search: q.search || undefined,
    page: pageOf(q.page),
    pageSize: 20,
    status: filter !== 'all' && filter !== 'collection' ? filter : undefined,
    inCollection: filter === 'collection' ? true : undefined,
  };
  const { data, isLoading, error, isFetching } = useCustomers(query, ready);

  const columns: Column<CustomerListItemDto>[] = [
    {
      key: 'name',
      header: 'Cliente',
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Avatar name={c.name} />
          <div className="min-w-0">
            <p className="truncate font-medium">{c.name}</p>
            <p className="text-xs text-muted-foreground tabular">{formatCpf(c.cpf)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contato',
      hideBelow: 'lg',
      cell: (c) => (
        <div className="text-sm">
          <p className="tabular">{c.phone ? formatPhone(c.phone) : '—'}</p>
          <p className="text-xs text-muted-foreground">{[c.city, c.state].filter(Boolean).join(' / ')}</p>
        </div>
      ),
    },
    {
      key: 'moto',
      header: 'Moto',
      cell: (c) =>
        c.currentMotorcycle ? (
          <div>
            <p className="font-mono text-sm">{formatPlate(c.currentMotorcycle.plate)}</p>
            <p className="text-xs text-muted-foreground">{c.currentMotorcycle.label}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Situação',
      cell: (c) => (
        <div className="flex flex-wrap gap-1.5">
          <CustomerStatusBadge status={c.status} />
          {c.inCollection && <Badge variant="destructive">Em cobrança</Badge>}
        </div>
      ),
    },
    {
      key: 'overdue',
      header: 'Em atraso',
      align: 'right',
      cell: (c) =>
        c.overdueCount > 0 ? (
          <div>
            <p className="font-medium text-destructive">{c.overdueAmount !== null ? formatBRL(c.overdueAmount) : `${c.overdueCount}`}</p>
            <p className="text-xs text-muted-foreground">{c.overdueCount === 1 ? '1 cobrança' : `${c.overdueCount} cobranças`}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'cnh',
      header: 'CNH',
      hideBelow: 'xl',
      cell: (c) => (c.cnhExpiresAt ? <ExpiryBadge state={c.cnhState} /> : <span className="text-muted-foreground">—</span>),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes"
        description={data ? `${data.total.toLocaleString('pt-BR')} ${data.total === 1 ? 'cliente' : 'clientes'}` : 'Cadastro e ficha completa dos locatários.'}
        actions={
          canManage && (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/admin/customers/new">
                <Plus /> Novo cliente
              </Link>
            </Button>
          )
        }
      />
      <Toolbar>
        <FilterChips value={filter} onChange={(v) => setQ({ status: v, page: '1' })} options={FILTERS.map((f) => ({ value: f, label: FILTER_LABEL(f) }))} />
        <SearchInput value={q.search ?? ''} onChange={(v) => setQ({ search: v, page: '1' })} placeholder="Nome, CPF, telefone ou placa" className="lg:w-80" />
      </Toolbar>
      <Card className={isFetching && !isLoading ? 'opacity-70 transition-opacity' : undefined}>
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : (
          <DataTable
            rows={ready ? data?.data : undefined}
            loading={isLoading || !ready}
            columns={columns}
            rowKey={(c) => c.id}
            onRowClick={(c) => router.push(`/admin/customers/${c.id}`)}
            rowClassName={(c) => (c.status === 'OVERDUE' || c.status === 'BLOCKED' ? 'bg-destructive/[0.03]' : undefined)}
            empty={{
              icon: Users,
              title: q.search ? 'Nenhum cliente encontrado' : 'Nenhum cliente aqui',
              description: q.search ? 'Tente outro nome, CPF ou placa.' : undefined,
            }}
            mobileCard={(c) => (
              <MobileRow
                leading={<Avatar name={c.name} />}
                title={c.name}
                subtitle={c.currentMotorcycle ? `${formatPlate(c.currentMotorcycle.plate)} · ${c.currentMotorcycle.label}` : formatCpf(c.cpf)}
                meta={
                  c.overdueCount > 0 ? (
                    <span className="font-medium text-destructive">
                      {c.overdueAmount !== null ? formatBRL(c.overdueAmount) : c.overdueCount} em atraso
                    </span>
                  ) : c.inCollection ? (
                    <span className="text-destructive">Em cobrança</span>
                  ) : undefined
                }
                right={<CustomerStatusBadge status={c.status} />}
              />
            )}
          />
        )}
        {data && data.totalPages > 1 && (
          <div className="border-t border-border p-3">
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} unit="clientes" onPageChange={(p) => setQ({ page: String(p) })} />
          </div>
        )}
      </Card>
    </div>
  );
}
