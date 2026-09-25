'use client';

import { AUDIT_ACTION_LABELS, AUDIT_ACTIONS, Permission, isYmd, type AuditAction } from '@locamania/shared';
import { History, Lock, X } from 'lucide-react';
import { useId } from 'react';

import { AuditRow, entityLabel } from '@/components/audit/audit-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SelectMenu } from '@/components/ui/select-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/client';
import { dayHeading, groupByDay } from '@/lib/audit/days';
import { AUDIT_ENTITY_TYPES } from '@/lib/audit/links';
import { useCan } from '@/lib/auth/use-auth';
import { useAudit, useUserOptions } from '@/lib/queries';
import { pageOf, useUrlState } from '@/lib/use-url-state';
import { cn, plural, todayYmd } from '@/lib/utils';

export default function AuditPage() {
  const canView = useCan(Permission.AUDIT_VIEW);
  const id = useId();
  const [q, setQ, ready] = useUrlState({ actorId: '', entityType: '', entityId: '', action: '', from: '', to: '', page: '1' });
  const users = useUserOptions();
  const action = (AUDIT_ACTIONS as string[]).includes(q.action) ? (q.action as AuditAction) : undefined;
  const from = isYmd(q.from) ? q.from : undefined;
  const to = isYmd(q.to) ? q.to : undefined;
  const { data, isLoading, error, isFetching } = useAudit(
    { actorId: q.actorId || undefined, entityType: q.entityType || undefined, entityId: q.entityId || undefined, action, from, to, page: pageOf(q.page), pageSize: 30 },
    ready && canView,
  );
  const filtered = !!(q.actorId || q.entityType || q.entityId || action || from || to);
  const today = todayYmd();

  if (!canView) {
    return <EmptyState icon={Lock} title="Sem acesso ao histórico" description="Só o proprietário e o administrador veem o histórico completo. O histórico de cada ficha aparece na própria ficha." />;
  }

  const entityOptions: { value: string; label: string }[] = AUDIT_ENTITY_TYPES.map((t) => ({ value: t, label: entityLabel(t) }));
  if (q.entityType && !entityOptions.some((o) => o.value === q.entityType)) entityOptions.unshift({ value: q.entityType, label: entityLabel(q.entityType) });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Histórico de alterações"
        description={data ? `${plural(data.total, 'registro', 'registros')}${filtered ? ' neste filtro' : ''} · quem fez o quê e quando` : 'Tudo o que foi feito no sistema: quem, o quê e quando.'}
      />

      {/* Filtros: uma linha no computador; grade de duas colunas no celular. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_150px_150px_auto] lg:items-end">
        <div className="col-span-2 space-y-1.5 lg:col-span-1">
          <label htmlFor={`${id}-user`} className="text-xs font-medium text-muted-foreground">
            Quem
          </label>
          <SelectMenu
            id={`${id}-user`}
            value={q.actorId}
            onChange={(v) => setQ({ actorId: v, page: '1' })}
            placeholder="Todos"
            options={(users.data ?? []).map((u) => ({ value: u.id, label: u.name }))}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-entity`} className="text-xs font-medium text-muted-foreground">
            O quê
          </label>
          <SelectMenu id={`${id}-entity`} value={q.entityType} onChange={(v) => setQ({ entityType: v, entityId: '', page: '1' })} placeholder="Tudo" options={entityOptions} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-action`} className="text-xs font-medium text-muted-foreground">
            Ação
          </label>
          <SelectMenu
            id={`${id}-action`}
            value={action ?? ''}
            onChange={(v) => setQ({ action: v, page: '1' })}
            placeholder="Todas"
            options={AUDIT_ACTIONS.map((a) => ({ value: a, label: AUDIT_ACTION_LABELS[a] }))}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-from`} className="text-xs font-medium text-muted-foreground">
            De
          </label>
          <Input id={`${id}-from`} type="date" value={from ?? ''} max={to ?? today} onChange={(e) => setQ({ from: e.target.value, page: '1' })} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-to`} className="text-xs font-medium text-muted-foreground">
            Até
          </label>
          <Input id={`${id}-to`} type="date" value={to ?? ''} min={from} max={today} onChange={(e) => setQ({ to: e.target.value, page: '1' })} />
        </div>
        {filtered && (
          <Button
            variant="ghost"
            className="col-span-2 lg:col-span-1"
            onClick={() => setQ({ actorId: '', entityType: '', entityId: '', action: '', from: '', to: '', page: '1' })}
          >
            <X /> Limpar filtros
          </Button>
        )}
      </div>

      {q.entityId && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Mostrando só um registro{q.entityType ? ` (${entityLabel(q.entityType).toLowerCase()})` : ''}.
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => setQ({ entityId: '', page: '1' })}>
            Ver todos
          </button>
        </p>
      )}

      <Card className={cn(isFetching && !isLoading && 'opacity-70 transition-opacity')}>
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : isLoading || !ready || !data ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : data.data.length === 0 ? (
          <EmptyState
            icon={History}
            title={filtered ? 'Nada encontrado neste filtro' : 'Nenhum registro ainda'}
            description={filtered ? 'Tente outro usuário, outro tipo ou outro período.' : 'Cada cadastro, alteração e pagamento aparece aqui.'}
          />
        ) : (
          <div>
            {groupByDay(data.data, (a) => a.occurredAt).map((g) => (
              <section key={g.day} aria-label={dayHeading(g.day, today)}>
                <h2 className="sticky top-14 z-[1] border-b border-border bg-muted/80 px-4 py-2 text-xs font-semibold text-muted-foreground backdrop-blur first:rounded-t-xl sm:top-16 sm:px-5">
                  {dayHeading(g.day, today)}
                </h2>
                <ol className="divide-y divide-border">
                  {g.items.map((item) => (
                    <AuditRow key={item.id} item={item} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
        {data && data.totalPages > 1 && (
          <div className="border-t border-border p-3">
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} unit="registros" onPageChange={(p) => setQ({ page: String(p) })} />
          </div>
        )}
      </Card>
    </div>
  );
}
