'use client';

import { Check, ChevronDown, Loader2, Plus, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export interface LookupOption {
  value: string;
  label: string;
  /** Texto secundário (ex.: província/país da cidade). */
  hint?: string;
  /** Marca itens cadastrados por usuário, ainda não curados. */
  isNew?: boolean;
}

export interface LookupProps {
  value: string | null;
  /** Rótulo do valor atual — evita buscar só para exibir o selecionado. */
  valueLabel?: string | null;
  onChange: (value: string | null, option?: LookupOption) => void;
  /** Chamado a cada tecla, para a tela buscar no servidor. */
  onSearchChange: (term: string) => void;
  options: LookupOption[];
  loading?: boolean;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  /** Quando existe, o rodapé oferece cadastrar o termo digitado. */
  onCreate?: (term: string) => Promise<LookupOption | null>;
  createLabel?: (term: string) => string;
  emptyLabel?: string;
}

/**
 * Campo de busca que só aceita valor SELECIONADO — digitar filtra, mas o texto
 * digitado nunca é gravado. Se o item não existe, o rodapé oferece cadastrá-lo
 * ali mesmo (sem passar pelo menu de parâmetros), e o registro novo já vem
 * selecionado.
 *
 * É o padrão do projeto para qualquer campo categórico: cidade, marca de drive,
 * interface, sistema operacional, tipo de defeito. Assim o relatório agrupa por
 * id/código, e não por dez grafias do mesmo nome.
 */
export function Lookup({
  value,
  valueLabel,
  onChange,
  onSearchChange,
  options,
  loading,
  placeholder = 'Buscar...',
  id,
  disabled,
  className,
  onCreate,
  createLabel = (t) => `Cadastrar "${t}"`,
  emptyLabel = 'Nada encontrado',
}: LookupProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listId = `${id ?? baseId}-list`;

  // Oferece cadastro só quando o termo não casa exatamente com nenhuma opção.
  const canCreate =
    Boolean(onCreate) &&
    term.trim().length >= 2 &&
    !options.some((o) => o.label.toLowerCase() === term.trim().toLowerCase());
  const rows = canCreate ? [...options, { value: '__create__', label: term.trim() }] : options;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setTerm('');
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => setActive(0), [options.length, term]);

  async function choose(i: number) {
    const row = rows[i];
    if (!row) return;

    if (row.value === '__create__' && onCreate) {
      setCreating(true);
      try {
        const created = await onCreate(row.label);
        if (created) {
          onChange(created.value, created);
          setOpen(false);
          setTerm('');
        }
      } finally {
        setCreating(false);
      }
      return;
    }
    onChange(row.value, row as LookupOption);
    setOpen(false);
    setTerm('');
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      void choose(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setTerm('');
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {open ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            autoFocus
            id={id}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              onSearchChange(e.target.value);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      ) : (
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => {
            setOpen(true);
            onSearchChange('');
          }}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm',
            'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value ? (valueLabel ?? '—') : placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      {open && (
        <div
          role="listbox"
          id={listId}
          tabIndex={-1}
          className="animate-in absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {loading && (
            <p className="flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Searching…
            </p>
          )}

          {!loading && rows.length === 0 && (
            <p className="px-2.5 py-2 text-sm text-muted-foreground">{emptyLabel}</p>
          )}

          {rows.map((row, i) => {
            const isCreate = row.value === '__create__';
            const selected = row.value === value;
            return (
              <div
                key={row.value}
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                onMouseEnter={() => setActive(i)}
                onClick={() => void choose(i)}
                // O teclado é tratado no input (aria-activedescendant); aqui só
                // para satisfazer a regra de elemento clicável.
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void choose(i);
                  }
                }}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded px-2.5 py-1.5 text-sm',
                  i === active && 'bg-accent text-accent-foreground',
                  isCreate && 'text-primary',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {isCreate ? (
                    creating ? (
                      <Loader2 className="size-3.5 shrink-0 animate-spin" />
                    ) : (
                      <Plus className="size-3.5 shrink-0" />
                    )
                  ) : (
                    <Check className={cn('size-3.5 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
                  )}
                  <span className="truncate">
                    {isCreate ? createLabel(row.label) : row.label}
                  </span>
                </span>
                {'hint' in row && row.hint && (
                  <span className="shrink-0 text-xs text-muted-foreground">{row.hint}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
