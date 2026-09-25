'use client';

import type { SearchResultDto } from '@locamania/shared';
import { useQuery } from '@tanstack/react-query';
import { Bike, FileText, Search, User, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Spinner } from '@/components/ui/spinner';
import { api, qs } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const ICONS: Record<SearchResultDto['type'], LucideIcon> = {
  customer: User,
  motorcycle: Bike,
  contract: FileText,
};

const GROUP_LABEL: Record<SearchResultDto['type'], string> = {
  customer: 'Clientes',
  motorcycle: 'Motos',
  contract: 'Contratos',
};

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen };
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Pesquisa rápida (§27): nome, CPF, telefone, placa, modelo, nº do contrato.
 * Placa ou número de contrato idêntico abre a ficha direto com Enter.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const q = useDebounced(term.trim(), 200);

  const { data = [], isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.get<SearchResultDto[]>(`/search${qs({ q })}`),
    enabled: open && q.length >= 2,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (open) {
      setTerm('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);
  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  function go(result: SearchResultDto | undefined) {
    if (!result) return;
    onOpenChange(false);
    router.push(result.link);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onOpenChange(false);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, data.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      go(data.find((r) => r.exact) ?? data[active]);
    }
  }

  const groups = (['motorcycle', 'customer', 'contract'] as const)
    .map((type) => ({ type, items: data.filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0);
  let index = -1;

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center p-0 sm:p-4 sm:pt-[12vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pesquisa"
        className="animate-in relative z-10 flex h-dvh w-full flex-col overflow-hidden bg-popover pt-safe shadow-2xl sm:h-auto sm:max-h-[70vh] sm:max-w-xl sm:rounded-xl sm:border sm:border-border"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Nome, CPF, telefone, placa, modelo ou nº do contrato"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            aria-label="Pesquisar"
          />
          {isFetching && <Spinner />}
          <button type="button" onClick={() => onOpenChange(false)} className="text-sm font-medium text-muted-foreground sm:hidden">
            Fechar
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {q.length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Digite pelo menos 2 letras. Placa ou nº de contrato exato abre direto com Enter.
            </p>
          ) : data.length === 0 && !isFetching ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nada encontrado para “{q}”.</p>
          ) : (
            groups.map((group) => (
              <div key={group.type} className="mb-2">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {GROUP_LABEL[group.type]}
                </p>
                {group.items.map((r) => {
                  index += 1;
                  const i = index;
                  const Icon = ICONS[r.type];
                  return (
                    <button
                      key={`${r.type}-${r.id}`}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left',
                        active === i ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="size-4 text-muted-foreground" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                      </span>
                      {r.exact && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Enter</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
