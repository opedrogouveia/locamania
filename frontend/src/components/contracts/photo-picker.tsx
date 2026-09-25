'use client';

import { Camera, FileText, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ACCEPT_UPLOAD, prepareUpload, type PreparedFile } from '@/lib/files';
import { cn, formatBytes } from '@/lib/utils';

/**
 * Fotos (ou PDF) escolhidas antes de salvar: ficam só no aparelho, reduzidas,
 * e sobem depois que o registro existe (entrega, devolução, assinatura). No
 * celular o botão abre a câmera ou a galeria.
 */
export function PhotoPicker({
  files,
  onChange,
  max = 10,
  label = 'Adicionar fotos',
  hint = 'Fotos são reduzidas antes do envio.',
  single,
  disabled,
}: {
  files: PreparedFile[];
  onChange: (files: PreparedFile[]) => void;
  max?: number;
  label?: string;
  hint?: string;
  /** Um arquivo só (ex.: contrato assinado escaneado). */
  single?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = single ? 1 : max;

  async function onPick(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setBusy(true);
    const next = single ? [] : [...files];
    try {
      for (const file of Array.from(list).slice(0, limit - next.length)) {
        next.push(await prepareUpload(file));
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_UPLOAD}
        multiple={!single}
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
      {files.length > 0 && (
        <ul className={cn('grid gap-2', single ? 'grid-cols-1' : 'grid-cols-3 sm:grid-cols-4')}>
          {files.map((f, i) => (
            <li
              key={`${f.fileName}-${i}`}
              className={cn(
                'relative overflow-hidden rounded-lg border border-border bg-muted',
                single ? 'flex items-center gap-3 p-2' : 'aspect-square',
              )}
            >
              {f.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.previewUrl}
                  alt=""
                  className={single ? 'size-12 rounded-md object-cover' : 'size-full object-cover'}
                />
              ) : (
                <div
                  className={cn(
                    'flex items-center justify-center text-muted-foreground',
                    single
                      ? 'size-12 rounded-md bg-card'
                      : 'size-full flex-col gap-1 p-2 text-center',
                  )}
                >
                  <FileText className="size-5" />
                  {!single && (
                    <span className="line-clamp-2 break-all text-[11px]">{f.fileName}</span>
                  )}
                </div>
              )}
              {single && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{f.fileName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatBytes(f.sizeBytes)}
                  </span>
                </span>
              )}
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className={cn(
                  'flex items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background',
                  single ? 'size-9' : 'absolute right-1 top-1 size-8',
                )}
                aria-label={`Remover ${f.fileName}`}
                disabled={disabled}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {files.length < limit && (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy || disabled}
          className="w-full sm:w-auto"
        >
          {busy ? <Loader2 className="animate-spin" /> : <Camera />}
          {busy
            ? 'Preparando...'
            : files.length
              ? single
                ? 'Trocar arquivo'
                : 'Adicionar mais'
              : label}
        </Button>
      )}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
