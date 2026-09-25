import { formatPlate } from '@locamania/shared';

import { cn } from '@/lib/utils';

/**
 * Placa da moto como aparece na rua: fonte monoespaçada, moldura e, no padrão
 * Mercosul, a faixa azul no topo. Ajuda a achar a moto certa de relance.
 */
export function Plate({
  plate,
  size = 'sm',
  className,
}: {
  plate: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const mercosul = /^[A-Z]{3}\d[A-Z]\d{2}$/.test(plate);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[5px] border border-foreground/25 bg-card font-mono font-semibold uppercase tracking-wider text-foreground',
        mercosul && 'border-t-[3px] border-t-primary',
        size === 'sm' && 'h-6 px-1.5 text-[13px]',
        size === 'md' && 'h-8 px-2 text-base',
        size === 'lg' && 'h-11 px-3 text-2xl sm:h-12 sm:text-[28px]',
        className,
      )}
    >
      {formatPlate(plate)}
    </span>
  );
}
