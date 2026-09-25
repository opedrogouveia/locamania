'use client';

import { CatalogGroup, Permission, type DocumentDto, type DocumentOwnerType, type Ymd } from '@locamania/shared';
import { Archive, Download, Eye, FileText, ImageIcon, MoreHorizontal, Paperclip, Pencil, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/kit';
import { SelectMenu } from '@/components/ui/select-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ExpiryBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { downloadFile, errorMessage, objectUrl, openFile } from '@/lib/api/client';
import { documentsApi } from '@/lib/api/resources';
import { useCan } from '@/lib/auth/use-auth';
import { ACCEPT_UPLOAD, prepareUpload, type PreparedFile } from '@/lib/files';
import { useArchiveDocument, useCatalog, useDocuments, useUpdateDocument, useUploadDocument } from '@/lib/queries';
import { formatBytes, formatYmd } from '@/lib/utils';

/** Miniatura autenticada (a imagem não tem URL pública). */
function Thumb({ doc }: { doc: DocumentDto }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!doc.isImage) return;
    let revoked: string | null = null;
    objectUrl(documentsApi.filePath(doc.id))
      .then((u) => {
        revoked = u;
        setUrl(u);
      })
      .catch(() => setUrl(null));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [doc.id, doc.isImage]);
  return (
    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-muted-foreground">
      {doc.isImage && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : doc.isImage ? (
        <ImageIcon className="size-5" />
      ) : (
        <FileText className="size-5" />
      )}
    </div>
  );
}

interface UploadState {
  file: PreparedFile | null;
  typeCode: string;
  title: string;
  expiresAt: Ymd | '';
  visibleToCustomer: boolean;
  notes: string;
}

function DocumentDialog({
  open,
  onOpenChange,
  ownerType,
  ownerId,
  editing,
  defaultType,
  defaultVisible,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ownerType: DocumentOwnerType;
  ownerId: string;
  editing: DocumentDto | null;
  defaultType?: string;
  defaultVisible?: boolean;
}) {
  const types = useCatalog(CatalogGroup.DOCUMENT_TYPE);
  const upload = useUploadDocument();
  const update = useUpdateDocument();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [s, setS] = useState<UploadState>({ file: null, typeCode: '', title: '', expiresAt: '', visibleToCustomer: false, notes: '' });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setS(
      editing
        ? { file: null, typeCode: editing.typeCode, title: editing.title, expiresAt: editing.expiresAt ?? '', visibleToCustomer: editing.visibleToCustomer, notes: editing.notes ?? '' }
        : { file: null, typeCode: defaultType ?? '', title: '', expiresAt: '', visibleToCustomer: defaultVisible ?? false, notes: '' },
    );
  }, [open, editing, defaultType, defaultVisible]);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreparing(true);
    try {
      const prepared = await prepareUpload(file);
      setS((prev) => ({ ...prev, file: prepared, title: prev.title || file.name.replace(/\.[^.]+$/, '') }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.');
    } finally {
      setPreparing(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!s.typeCode) return setError('Escolha o tipo do documento.');
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, typeCode: s.typeCode, title: s.title, expiresAt: s.expiresAt || null, visibleToCustomer: s.visibleToCustomer, notes: s.notes || null });
        toast.success('Documento atualizado');
      } else {
        if (!s.file) return setError('Escolha o arquivo ou tire uma foto.');
        await upload.mutateAsync({
          ownerType,
          ownerId,
          typeCode: s.typeCode,
          title: s.title || null,
          fileName: s.file.fileName,
          mimeType: s.file.mimeType,
          dataBase64: s.file.dataBase64,
          expiresAt: s.expiresAt || null,
          visibleToCustomer: s.visibleToCustomer,
          notes: s.notes || null,
        });
        toast.success('Documento enviado');
      }
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const busy = upload.isPending || update.isPending || preparing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar documento' : 'Enviar documento ou foto'}</DialogTitle>
          <DialogDescription>Foto (JPG, PNG) ou PDF de até 8 MB. Fotos são reduzidas antes do envio.</DialogDescription>
        </DialogHeader>

        {!editing && (
          <div>
            <input ref={inputRef} type="file" accept={ACCEPT_UPLOAD} className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed border-input bg-muted/40 p-4 text-left transition-colors hover:bg-accent"
            >
              {s.file?.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.file.previewUrl} alt="" className="size-14 rounded-md object-cover" />
              ) : (
                <span className="flex size-14 items-center justify-center rounded-md bg-card text-muted-foreground">
                  {s.file ? <FileText className="size-6" /> : <Upload className="size-6" />}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{preparing ? 'Preparando...' : s.file ? s.file.fileName : 'Escolher arquivo ou tirar foto'}</span>
                <span className="block text-xs text-muted-foreground">{s.file ? formatBytes(s.file.sizeBytes) : 'Toque para abrir a câmera ou os arquivos'}</span>
              </span>
            </button>
          </div>
        )}

        <Field label="Tipo" required>
          {(id) => (
            <SelectMenu
              id={id}
              value={s.typeCode}
              onChange={(v) => setS((p) => ({ ...p, typeCode: v }))}
              placeholder="Escolha o tipo"
              options={(types.data ?? []).map((t) => ({ value: t.code, label: t.label }))}
            />
          )}
        </Field>
        <Field label="Título">{(id) => <Input id={id} value={s.title} onChange={(e) => setS((p) => ({ ...p, title: e.target.value }))} maxLength={120} />}</Field>
        <Field label="Validade" hint="Deixe em branco se o documento não vence.">
          {(id) => <Input id={id} type="date" value={s.expiresAt} onChange={(e) => setS((p) => ({ ...p, expiresAt: e.target.value }))} />}
        </Field>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <label htmlFor="doc-visible-to-customer">
            <span className="block text-sm font-medium">Visível para o cliente no app</span>
            <span className="block text-xs text-muted-foreground">Ex.: CRLV da moto, contrato assinado.</span>
          </label>
          <Switch id="doc-visible-to-customer" checked={s.visibleToCustomer} onCheckedChange={(v) => setS((p) => ({ ...p, visibleToCustomer: v }))} />
        </div>
        <Field label="Observações">{(id) => <Textarea id={id} rows={2} value={s.notes} onChange={(e) => setS((p) => ({ ...p, notes: e.target.value }))} />}</Field>
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {editing ? 'Salvar' : 'Enviar'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/**
 * Documentos e fotos de qualquer ficha (cliente, moto, contrato, manutenção,
 * ocorrência...). Upload com redução de imagem, validade e visibilidade no app.
 */
export function DocumentsPanel({
  ownerType,
  ownerId,
  title = 'Documentos e fotos',
  defaultType,
  defaultVisible,
  compact,
}: {
  ownerType: DocumentOwnerType;
  ownerId: string;
  title?: string;
  defaultType?: string;
  defaultVisible?: boolean;
  compact?: boolean;
}) {
  const canManage = useCan(Permission.DOCUMENTS_MANAGE);
  const { data, isLoading, error } = useDocuments({ ownerType, ownerId, pageSize: 100 });
  const archive = useArchiveDocument();
  const confirm = useConfirm();
  const [dialog, setDialog] = useState<{ open: boolean; editing: DocumentDto | null }>({ open: false, editing: null });

  async function onArchive(doc: DocumentDto) {
    const ok = await confirm({ title: 'Arquivar documento?', description: `"${doc.title}" sai da ficha, mas fica no histórico.`, confirmText: 'Arquivar', variant: 'destructive' });
    if (!ok) return;
    try {
      await archive.mutateAsync(doc.id);
      toast.success('Documento arquivado');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function run(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const docs = data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {!compact && <h3 className="text-base font-semibold">{title}</h3>}
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, editing: null })} className={compact ? 'ml-auto' : undefined}>
            <Paperclip /> Anexar
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{errorMessage(error)}</p>
      ) : docs.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum documento" description={canManage ? 'Anexe fotos e documentos pelo botão acima.' : undefined} className="py-8" />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 p-3">
              <button type="button" onClick={() => run(() => openFile(documentsApi.filePath(doc.id)))} className="shrink-0" aria-label={`Abrir ${doc.title}`}>
                <Thumb doc={doc} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {doc.typeLabel} · {formatBytes(doc.sizeBytes)}
                  {doc.expiresAt && ` · vence ${formatYmd(doc.expiresAt)}`}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {doc.expiresAt && <ExpiryBadge state={doc.expiryState} />}
                  {doc.visibleToCustomer && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="size-3" /> no app
                    </span>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Ações do documento</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => run(() => openFile(documentsApi.filePath(doc.id)))}>
                    <Eye /> Abrir
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => run(() => downloadFile(documentsApi.filePath(doc.id), doc.fileName))}>
                    <Download /> Baixar
                  </DropdownMenuItem>
                  {canManage && (
                    <>
                      <DropdownMenuItem onSelect={() => setDialog({ open: true, editing: doc })}>
                        <Pencil /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onArchive(doc)}>
                        <Archive /> Arquivar
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}
      <DocumentDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        ownerType={ownerType}
        ownerId={ownerId}
        editing={dialog.editing}
        defaultType={defaultType}
        defaultVisible={defaultVisible}
      />
    </div>
  );
}

