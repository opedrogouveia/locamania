'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Autosave sem botão "Salvar".
 *
 * Regras que valem para toda a interface:
 * - campo de texto grava no **blur**, e só se o valor mudou;
 * - select, toggle e data gravam na **hora** (a escolha já é a intenção);
 * - o retorno é um único estado para a tela mostrar "Salvando…/Salvo", em vez de
 *   um toast por campo (que viraria ruído com 30 campos por tela).
 */
export function useAutosave<T>(save: (patch: T) => Promise<unknown>) {
  const [state, setState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(0);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const commit = useCallback(
    async (patch: T) => {
      pending.current += 1;
      setState('saving');
      try {
        await save(patch);
        pending.current -= 1;
        // Só sinaliza "salvo" quando não há outra gravação em curso.
        if (pending.current === 0) {
          setState('saved');
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setState('idle'), 2500);
        }
        return true;
      } catch {
        pending.current -= 1;
        setState('error');
        return false;
      }
    },
    [save],
  );

  return { state, commit };
}

/**
 * Campo de texto com autosave: mantém o valor digitado local e grava no blur
 * apenas quando difere do original (evita PATCH a cada foco perdido).
 */
export function useAutosaveText(
  original: string | null | undefined,
  onCommit: (value: string | null) => void,
) {
  const [value, setValue] = useState(original ?? '');

  // Se o registro for recarregado por fora, reflete o valor novo.
  useEffect(() => {
    setValue(original ?? '');
  }, [original]);

  return {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValue(e.target.value),
    onBlur: () => {
      const trimmed = value.trim();
      if (trimmed !== (original ?? '')) onCommit(trimmed || null);
    },
  };
}
