'use client';

import { CheckCircle2, Info, X, XCircle, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let counter = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l([...toasts]);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function add(
  title: string,
  variant: ToastVariant,
  opts?: { description?: string; duration?: number },
) {
  const id = ++counter;
  const duration = opts?.duration ?? 4000;
  toasts = [...toasts, { id, title, variant, description: opts?.description, duration }];
  emit();
  return id;
}

/** API imperativa de toasts: `toast.success('Salvo!')`. */
export const toast = Object.assign(
  (title: string, opts?: { description?: string; duration?: number }) =>
    add(title, 'default', opts),
  {
    success: (title: string, opts?: { description?: string; duration?: number }) =>
      add(title, 'success', opts),
    error: (title: string, opts?: { description?: string; duration?: number }) =>
      add(title, 'error', opts),
    warning: (title: string, opts?: { description?: string; duration?: number }) =>
      add(title, 'warning', opts),
    info: (title: string, opts?: { description?: string; duration?: number }) =>
      add(title, 'info', opts),
    dismiss,
  },
);

const ICONS: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
};

const ACCENT: Record<ToastVariant, string> = {
  default: 'text-foreground',
  success: 'text-success',
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
};

function ToastCard({ t }: { t: Toast }) {
  const Icon = ICONS[t.variant];

  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration]);

  return (
    <div className="animate-toast-in pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg">
      <Icon className={cn('mt-0.5 size-5 shrink-0', ACCENT[t.variant])} />
      <div className="flex-1 space-y-0.5">
        <p className="text-sm font-medium leading-tight">{t.title}</p>
        {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
      </div>
      <button
        onClick={() => dismiss(t.id)}
        className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    setItems([...toasts]);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4">
      {items.map((t) => (
        <ToastCard key={t.id} t={t} />
      ))}
    </div>
  );
}
