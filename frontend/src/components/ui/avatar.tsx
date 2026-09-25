import { cn } from '@/lib/utils';

/** Iniciais a partir de um nome (até 2 letras). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 select-none items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary',
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
