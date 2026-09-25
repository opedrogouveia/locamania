'use client';

import { createContext, useContext, useId, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Abas acessíveis, sem dependência externa (mesmo padrão hand-rolled dos outros
 * primitivos). Navegação por teclado: ←/→ movem, Home/End vão para as pontas.
 */
interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
  baseId: string;
}
const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used within <Tabs>');
  return ctx;
}

export function Tabs({
  defaultValue,
  value: controlled,
  onValueChange,
  children,
  className,
}: {
  defaultValue: string;
  /** Controlado (ex.: aba na URL, para o link abrir direto nela). */
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const value = controlled ?? internal;
  const setValue = (next: string) => {
    if (controlled === undefined) setInternal(next);
    onValueChange?.(next);
  };
  const baseId = useId();
  return (
    <TabsContext.Provider value={{ value, setValue, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      // No celular as abas rolam de lado em vez de quebrar em várias linhas.
      className={cn(
        'no-scrollbar -mx-4 flex items-center gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  icon: Icon,
  disabled = false,
  title,
}: {
  value: string;
  children: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Aba que existe mas ainda não pode ser aberta. */
  disabled?: boolean;
  /** Explica por que está travada, no hover. */
  title?: string;
}) {
  const { value: active, setValue, baseId } = useTabs();
  const selected = active === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      title={title}
      onClick={() => setValue(value)}
      onKeyDown={(e) => {
        // Move entre as abas irmãs sem sair do teclado. As travadas ficam fora
        // do caminho: seta encostar numa delas e parar seria um beco sem saída.
        const tabs = Array.from(
          e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
            '[role="tab"]:not(:disabled)',
          ) ?? [],
        );
        const i = tabs.indexOf(e.currentTarget);
        const go = (n: number) => {
          e.preventDefault();
          tabs[(n + tabs.length) % tabs.length]?.focus();
          tabs[(n + tabs.length) % tabs.length]?.click();
        };
        if (e.key === 'ArrowRight') go(i + 1);
        if (e.key === 'ArrowLeft') go(i - 1);
        if (e.key === 'Home') go(0);
        if (e.key === 'End') go(tabs.length - 1);
      }}
      className={cn(
        '-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4',
        selected
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-40 hover:border-transparent hover:text-muted-foreground',
      )}
    >
      {Icon && <Icon className="size-4" />}
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: active, baseId } = useTabs();
  if (active !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      className={cn('pt-5', className)}
    >
      {children}
    </div>
  );
}
