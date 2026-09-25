'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  /** Texto secundário à direita (ex.: papel do usuário, prazo do nível). */
  hint?: string;
}

export interface SelectMenuProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Rótulo da opção vazia. Omitir torna a seleção obrigatória. */
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Select com menu renderizado por nós — o `<select>` nativo não permite
 * estilizar a lista aberta (ela é desenhada pelo sistema operacional, o que
 * destoava do resto da interface).
 *
 * Teclado: ↑/↓ navegam, Enter/Espaço confirmam, Esc fecha, Home/End vão às
 * pontas, e digitar letras salta para a opção que começa com elas.
 */
export function SelectMenu({
  value,
  onChange,
  options,
  placeholder,
  id,
  disabled,
  className,
  'aria-label': ariaLabel,
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const baseId = useId();
  const listId = `${id ?? baseId}-list`;

  const items = useMemo<SelectOption[]>(
    () => (placeholder ? [{ value: '', label: placeholder }, ...options] : options),
    [options, placeholder],
  );
  const selected = items.find((o) => o.value === value);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Ao abrir, posiciona o destaque na opção atual e rola até ela.
  useEffect(() => {
    if (!open) return;
    const i = items.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
  }, [open, items, value]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelectorAll('[role="option"]')[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function commit(i: number) {
    const option = items[i];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(items.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(active);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default: {
        // Busca incremental: digitar "ma" salta para "Marc".
        if (e.key.length !== 1) return;
        const now = Date.now();
        typed.current.text = now - typed.current.at > 700 ? e.key : typed.current.text + e.key;
        typed.current.at = now;
        const term = typed.current.text.toLowerCase();
        const found = items.findIndex((o) => o.label.toLowerCase().startsWith(term));
        if (found >= 0) setActive(found);
      }
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm',
          'ring-offset-background transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open && 'ring-2 ring-ring ring-offset-2',
        )}
      >
        <span className={cn('truncate', !selected?.value && 'text-muted-foreground')}>
          {selected?.label ?? placeholder ?? 'Select...'}
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          id={listId}
          // O foco permanece no combobox; a lista só reflete o item ativo.
          tabIndex={-1}
          aria-activedescendant={`${listId}-${active}`}
          className="animate-in absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {items.map((option, i) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value || '__empty'}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSelected}
                // Navegação é pelo combobox (aria-activedescendant); as opções
                // não recebem foco, então declaramos tabIndex -1 e tratamos
                // teclado no botão.
                tabIndex={-1}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    commit(i);
                  }
                }}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded px-2.5 py-1.5 text-sm',
                  i === active && 'bg-accent text-accent-foreground',
                  !option.value && 'text-muted-foreground',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Check className={cn('size-3.5 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{option.label}</span>
                </span>
                {option.hint && (
                  <span className="shrink-0 text-xs text-muted-foreground">{option.hint}</span>
                )}
              </div>
            );
          })}
          {items.length === 0 && (
            <p className="px-2.5 py-2 text-sm text-muted-foreground">Nenhuma opção</p>
          )}
        </div>
      )}
    </div>
  );
}
