'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';

/** Copia um texto (link de acesso, código PIX) com retorno visual. */
export function CopyButton({ text, label = 'Copiar', copiedLabel = 'Copiado', ...props }: { text: string; label?: string; copiedLabel?: string } & ButtonProps) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      {...props}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          toast.error('Não foi possível copiar. Selecione e copie manualmente.');
        }
      }}
    >
      {done ? <Check /> : <Copy />}
      {done ? copiedLabel : label}
    </Button>
  );
}
