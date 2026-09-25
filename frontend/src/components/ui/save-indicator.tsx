'use client';

import { AlertCircle, Check, Loader2 } from 'lucide-react';

import type { SaveState } from '@/lib/forms/use-autosave';
import { cn } from '@/lib/utils';

/**
 * Sinal de que a tela salva sozinha. Substitui o botão "Salvar": sem ele, o
 * usuário precisa de alguma confirmação de que a alteração foi gravada.
 */
export function SaveIndicator({ state, className }: { state: SaveState; className?: string }) {
  if (state === 'idle') return null;

  const content = {
    saving: { icon: Loader2, text: 'Salvando…', cls: 'text-muted-foreground', spin: true },
    saved: { icon: Check, text: 'Salvo', cls: 'text-success', spin: false },
    error: { icon: AlertCircle, text: 'Não foi salvo', cls: 'text-destructive', spin: false },
  }[state];

  const Icon = content.icon;
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center gap-1.5 text-xs', content.cls, className)}
    >
      <Icon className={cn('size-3.5', content.spin && 'animate-spin')} />
      {content.text}
    </span>
  );
}
