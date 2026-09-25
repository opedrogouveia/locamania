'use client';

import type { CatalogGroup, CatalogItemDto } from '@locamania/shared';
import { ArrowDown, ArrowUp, ListChecks, Loader2, MoreHorizontal, Pencil, Plus, Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { FilterChips, SearchInput } from '@/components/ui/kit';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCatalog, useCreateCatalog, useUpdateCatalog } from '@/lib/queries';
import { CATALOG_GROUP_META } from '@/lib/settings/meta';
import { cn } from '@/lib/utils';

type View = 'all' | 'active' | 'inactive' | 'new';

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Uma lista do catálogo (marcas, modelos, tipos de documento, categorias). */
export function CatalogPanel({ group }: { group: CatalogGroup }) {
  const meta = CATALOG_GROUP_META[group];
  const { data, isLoading, error } = useCatalog(group, true);
  const create = useCreateCatalog();
  const update = useUpdateCatalog();
  const [newLabel, setNewLabel] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [view, setView] = useState<View>('all');
  const [search, setSearch] = useState('');

  const items = [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'pt-BR'));
  const counts = {
    active: items.filter((i) => i.active).length,
    inactive: items.filter((i) => !i.active).length,
    new: items.filter((i) => i.userCreated).length,
  };
  const term = normalize(search.trim());
  const shown = items.filter(
    (i) =>
      (view === 'all' || (view === 'active' && i.active) || (view === 'inactive' && !i.active) || (view === 'new' && i.userCreated)) &&
      (!term || normalize(i.label).includes(term)),
  );
  const canReorder = view === 'all' && !term;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) {
      setAddError('Escreva o nome.');
      return;
    }
    setAddError(null);
    try {
      const item = await create.mutateAsync({ group, label });
      setNewLabel('');
      toast.success(`"${item.label}" adicionado`, { description: meta.label });
    } catch (err) {
      setAddError(errorMessage(err));
    }
  }

  async function patch(item: CatalogItemDto, body: { label?: string; active?: boolean }, ok: string) {
    setBusyId(item.id);
    try {
      await update.mutateAsync({ id: item.id, ...body });
      toast.success(ok);
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function rename(item: CatalogItemDto) {
    if (!editing) return;
    const label = editing.label.trim();
    if (!label) return toast.error('Escreva o nome.');
    if (label === item.label) return setEditing(null);
    if (await patch(item, { label }, `Renomeado para "${label}"`)) setEditing(null);
  }

  /** Troca de lugar com o vizinho e renumera (10, 20, 30…) só o que mudou. */
  async function move(item: CatalogItemDto, dir: -1 | 1) {
    const i = items.findIndex((x) => x.id === item.id);
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    const changes = next.map((x, idx) => ({ x, order: (idx + 1) * 10 })).filter(({ x, order }) => x.sortOrder !== order);
    setBusyId(item.id);
    try {
      for (const { x, order } of changes) await update.mutateAsync({ id: x.id, sortOrder: order });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{meta.description} Itens desativados somem das opções, mas continuam no histórico.</p>

      <form onSubmit={add} className="space-y-1.5" noValidate>
        <label htmlFor={`add-${group}`} className="text-[13px] font-medium">
          Adicionar {meta.singular}
        </label>
        <div className="flex gap-2">
          <Input
            id={`add-${group}`}
            value={newLabel}
            onChange={(e) => {
              setNewLabel(e.target.value);
              setAddError(null);
            }}
            placeholder={meta.placeholder}
            maxLength={80}
            autoCapitalize="sentences"
            className="min-w-0 flex-1 sm:max-w-sm"
          />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Adicionar
          </Button>
        </div>
        {addError && <p className="text-xs text-destructive">{addError}</p>}
      </form>

      {counts.new > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-info/30 bg-info/8 p-3 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          <p>
            {counts.new === 1 ? '1 item foi cadastrado' : `${counts.new} itens foram cadastrados`} direto num formulário e {counts.new === 1 ? 'está marcado' : 'estão marcados'} como{' '}
            <strong>Novo</strong>. Confira a grafia — se estiver repetido, desative.
          </p>
        </div>
      )}

      {(items.length > 8 || view !== 'all') && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <FilterChips
            value={view}
            onChange={setView}
            options={[
              { value: 'all', label: 'Todos', count: items.length },
              { value: 'active', label: 'Ativos', count: counts.active },
              { value: 'inactive', label: 'Desativados', count: counts.inactive },
              ...(counts.new ? [{ value: 'new' as const, label: 'Novos', count: counts.new, tone: 'warning' as const }] : []),
            ]}
          />
          {items.length > 8 && <SearchInput value={search} onChange={setSearch} placeholder={`Buscar ${meta.singular}`} className="md:w-64" />}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={TriangleAlert} title="Não foi possível carregar a lista" description={errorMessage(error)} />
      ) : shown.length === 0 ? (
        <EmptyState icon={ListChecks} title={items.length ? 'Nada encontrado' : 'Lista vazia'} description={items.length ? 'Tente outro filtro ou busca.' : `Adicione a primeira ${meta.singular} acima.`} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {shown.map((item) => {
            const idx = items.findIndex((x) => x.id === item.id);
            const busy = busyId === item.id;
            const isEditing = editing?.id === item.id;
            return (
              <li key={item.id} className={cn('flex min-h-14 items-center gap-2 px-3 py-2 sm:px-4', !item.active && 'bg-muted/40')}>
                {isEditing ? (
                  <form
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void rename(item);
                    }}
                  >
                    <Input
                      autoFocus
                      value={editing.label}
                      onChange={(e) => setEditing({ id: item.id, label: e.target.value })}
                      onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                      maxLength={80}
                      aria-label={`Novo nome para ${item.label}`}
                      className="min-w-0 flex-1 basis-40"
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={busy}>
                        {busy && <Loader2 className="animate-spin" />}
                        Salvar
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-[15px] font-medium sm:text-sm', !item.active && 'text-muted-foreground')}>{item.label}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {item.userCreated && <Badge variant="info">Novo</Badge>}
                        {!item.active && <Badge variant="muted">Desativado</Badge>}
                      </div>
                    </div>

                    {canReorder && (
                      <div className="hidden items-center md:flex">
                        <Button type="button" variant="ghost" size="icon" disabled={busy || idx === 0} onClick={() => void move(item, -1)} aria-label={`Subir ${item.label}`}>
                          <ArrowUp />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" disabled={busy || idx === items.length - 1} onClick={() => void move(item, 1)} aria-label={`Descer ${item.label}`}>
                          <ArrowDown />
                        </Button>
                      </div>
                    )}
                    <Button type="button" variant="ghost" size="icon" className="hidden md:inline-flex" onClick={() => setEditing({ id: item.id, label: item.label })} aria-label={`Renomear ${item.label}`}>
                      <Pencil />
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent md:hidden">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Ações de {item.label}</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing({ id: item.id, label: item.label })}>
                          <Pencil /> Renomear
                        </DropdownMenuItem>
                        {canReorder && idx > 0 && (
                          <DropdownMenuItem onSelect={() => void move(item, -1)}>
                            <ArrowUp /> Subir na lista
                          </DropdownMenuItem>
                        )}
                        {canReorder && idx < items.length - 1 && (
                          <DropdownMenuItem onSelect={() => void move(item, 1)}>
                            <ArrowDown /> Descer na lista
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex w-12 shrink-0 justify-end">
                      {busy ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
                      ) : (
                        <>
                          <label htmlFor={`sw-${item.id}`} className="sr-only">
                            {item.label} ativo
                          </label>
                          <Switch
                            id={`sw-${item.id}`}
                            checked={item.active}
                            onCheckedChange={(active) => void patch(item, { active }, active ? `"${item.label}" ativado` : `"${item.label}" desativado`)}
                          />
                        </>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
