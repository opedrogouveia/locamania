'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Barra de "alterações não salvas": presa acima da barra inferior no celular e
 * flutuando no rodapé no desktop. Só aparece quando há algo pendente.
 */
export function PendingBar({
  count,
  busy,
  onSave,
  onDiscard,
  saveLabel = 'Salvar alterações',
}: {
  count: number;
  busy?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: string;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-[calc(4.4rem+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <p className="text-sm font-medium">
          {count === 1 ? '1 alteração não salva' : `${count} alterações não salvas`}
        </p>
        <div className="flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
          <Button type="button" variant="outline" onClick={onDiscard} disabled={busy}>
            Descartar
          </Button>
          <Button type="button" onClick={onSave} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
