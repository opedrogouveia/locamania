'use client';

import {
  Permission,
  todayYmd,
  type CreateMaintenanceRecordRequest,
  type MaintenanceRecordDto,
  type UpdateMaintenanceRecordRequest,
} from '@locamania/shared';
import { Camera, FileText, Loader2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Plate } from '@/components/motorcycles/plate';
import { MotorcycleLookup } from '@/components/pickers/entity-lookup';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field, FormGrid } from '@/components/ui/kit';
import { MoneyInput, NumberInput } from '@/components/ui/masked-input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { ACCEPT_UPLOAD, prepareUpload, type PreparedFile } from '@/lib/files';
import { useWorkshopSuggestions } from '@/lib/motorcycles/queries';
import {
  useCreateMaintenance,
  useMaintenanceTypes,
  useMotorcycle,
  useUpdateMaintenance,
  useUploadDocument,
} from '@/lib/queries';
import { cn, formatBytes, formatKm, formatPlate } from '@/lib/utils';
import { MaintenanceTypePicker } from './type-picker';

type NewStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'DONE';

const STATUS_OPTIONS: { value: NewStatus; label: string; hint: string }[] = [
  { value: 'SCHEDULED', label: 'Agendar', hint: 'Vai acontecer numa data.' },
  { value: 'IN_PROGRESS', label: 'Em andamento', hint: 'A moto está na oficina agora.' },
  { value: 'DONE', label: 'Já realizada', hint: 'Registrar um serviço já feito.' },
];

export interface MaintenancePreset {
  motorcycle?: { id: string; plate: string; label: string } | null;
  typeIds?: string[];
  status?: NewStatus;
}

interface Values {
  motorcycleId: string | null;
  motorcycleLabel: string | null;
  typeIds: string[];
  status: NewStatus;
  scheduledFor: string;
  startedAt: string;
  completedAt: string;
  km: number | null;
  workshop: string;
  parts: string;
  cost: string;
  notes: string;
  setInMaintenance: boolean;
}

function initial(preset?: MaintenancePreset | null, record?: MaintenanceRecordDto | null): Values {
  const today = todayYmd();
  if (record) {
    return {
      motorcycleId: record.motorcycle.id,
      motorcycleLabel: record.motorcycle.label,
      typeIds: record.types.map((t) => t.id),
      status: record.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'SCHEDULED',
      scheduledFor: record.scheduledFor ?? '',
      startedAt: record.startedAt ?? '',
      completedAt: record.completedAt ?? '',
      km: record.km,
      workshop: record.workshop ?? '',
      parts: record.parts ?? '',
      cost: record.cost ?? '',
      notes: record.notes ?? '',
      setInMaintenance: true,
    };
  }
  return {
    motorcycleId: preset?.motorcycle?.id ?? null,
    motorcycleLabel: preset?.motorcycle
      ? `${formatPlate(preset.motorcycle.plate)} · ${preset.motorcycle.label}`
      : null,
    typeIds: preset?.typeIds ?? [],
    status: preset?.status ?? 'SCHEDULED',
    scheduledFor: '',
    startedAt: today,
    completedAt: today,
    km: null,
    workshop: '',
    parts: '',
    cost: '',
    notes: '',
    setInMaintenance: true,
  };
}

/**
 * Nova manutenção (agendar, em andamento ou já realizada) e edição de uma que
 * ainda não foi concluída. Fotos e comprovantes vão junto (§24, §41).
 */
export function MaintenanceFormDialog({
  open,
  onOpenChange,
  preset,
  record,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preset?: MaintenancePreset | null;
  /** Editar um registro agendado/em andamento. */
  record?: MaintenanceRecordDto | null;
  onSaved?: (record: MaintenanceRecordDto) => void;
}) {
  const editing = !!record;
  const canFinance = useCan(Permission.FINANCE_VIEW);
  const canDocs = useCan(Permission.DOCUMENTS_MANAGE);
  const create = useCreateMaintenance();
  const update = useUpdateMaintenance();
  const upload = useUploadDocument();
  const types = useMaintenanceTypes();
  const workshops = useWorkshopSuggestions(open);
  const listId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState<Values>(() => initial(preset, record));
  const [files, setFiles] = useState<PreparedFile[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const moto = useMotorcycle(v.motorcycleId ?? undefined);
  const lockedMoto = editing || !!preset?.motorcycle;

  useEffect(() => {
    if (!open) return;
    setV(initial(preset, record));
    setFiles([]);
    setError(null);
  }, [open, preset, record]);

  // Moto escolhida: km atual como sugestão e "em manutenção" só se não estiver com cliente.
  const motoData = moto.data;
  useEffect(() => {
    if (!motoData || editing) return;
    setV((p) => ({ ...p, setInMaintenance: motoData.status !== 'RENTED' }));
  }, [motoData, editing, open]);
  // Em andamento/realizada: o km atual da moto já vem sugerido (agendada fica em branco).
  useEffect(() => {
    if (!motoData || editing || v.status === 'SCHEDULED') return;
    setV((p) => (p.km === null ? { ...p, km: motoData.currentKm } : p));
  }, [motoData, editing, open, v.status]);

  const set = <K extends keyof Values>(k: K, value: Values[K]) =>
    setV((p) => ({ ...p, [k]: value }));
  const today = todayYmd();

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    setPreparing(true);
    setError(null);
    try {
      const prepared = await Promise.all(
        Array.from(list)
          .slice(0, 8)
          .map((f) => prepareUpload(f)),
      );
      setFiles((p) => [...p, ...prepared].slice(0, 8));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.');
    } finally {
      setPreparing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!v.motorcycleId) return setError('Escolha a moto.');
    if (!v.typeIds.length) return setError('Escolha pelo menos um serviço.');
    if (!editing && v.status === 'SCHEDULED' && !v.scheduledFor)
      return setError('Informe a data agendada.');
    if (!editing && v.status === 'DONE') {
      if (!v.completedAt) return setError('Informe a data em que foi feita.');
      if (v.completedAt > today)
        return setError('A data da manutenção realizada não pode ser no futuro.');
      if (v.km === null) return setError('Informe a quilometragem da moto no serviço.');
    }
    const n = (s: string) => (s.trim() ? s.trim() : null);
    setBusy(true);
    try {
      let saved: MaintenanceRecordDto;
      if (editing && record) {
        const body: UpdateMaintenanceRecordRequest = {
          typeIds: v.typeIds,
          scheduledFor: n(v.scheduledFor),
          startedAt: record.status === 'IN_PROGRESS' ? n(v.startedAt) : undefined,
          km: v.km,
          workshop: n(v.workshop),
          parts: n(v.parts),
          notes: n(v.notes),
        };
        if (canFinance) body.cost = v.cost || null;
        saved = await update.mutateAsync({ id: record.id, ...body });
        toast.success('Manutenção atualizada');
      } else {
        const body: CreateMaintenanceRecordRequest = {
          motorcycleId: v.motorcycleId,
          typeIds: v.typeIds,
          status: v.status,
          scheduledFor: v.status === 'SCHEDULED' ? v.scheduledFor : null,
          startedAt: v.status === 'IN_PROGRESS' ? n(v.startedAt) : null,
          completedAt: v.status === 'DONE' ? v.completedAt : null,
          km: v.km,
          workshop: n(v.workshop),
          parts: n(v.parts),
          notes: n(v.notes),
          setMotorcycleInMaintenance: v.status === 'IN_PROGRESS' ? v.setInMaintenance : undefined,
        };
        if (canFinance) body.cost = v.cost || null;
        saved = await create.mutateAsync(body);
        let failed = 0;
        const title = saved.types.map((t) => t.name).join(', ');
        for (const f of files) {
          try {
            await upload.mutateAsync({
              ownerType: 'MAINTENANCE',
              ownerId: saved.id,
              typeCode: f.mimeType === 'application/pdf' ? 'MAINTENANCE_RECEIPT' : 'OTHER',
              title:
                f.mimeType === 'application/pdf' ? `Comprovante — ${title}` : `Foto — ${title}`,
              fileName: f.fileName,
              mimeType: f.mimeType,
              dataBase64: f.dataBase64,
            });
          } catch {
            failed += 1;
          }
        }
        const what =
          v.status === 'SCHEDULED'
            ? 'Manutenção agendada'
            : v.status === 'IN_PROGRESS'
              ? 'Manutenção iniciada'
              : 'Manutenção registrada';
        toast.success(what, {
          description:
            v.status === 'DONE'
              ? 'O próximo intervalo já foi recalculado.'
              : `${formatPlate(saved.motorcycle.plate)} · ${title}`,
        });
        if (failed)
          toast.warning(
            `${failed === 1 ? '1 arquivo não foi enviado' : `${failed} arquivos não foram enviados`}`,
            { description: 'Anexe de novo pela manutenção.' },
          );
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const typeNames = (types.data ?? []).filter((t) => v.typeIds.includes(t.id)).map((t) => t.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-2xl">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar manutenção' : 'Nova manutenção'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Para finalizar, use "Concluir" — é ali que o sistema recalcula o próximo intervalo.'
              : 'Ao concluir, o sistema recalcula a próxima troca/revisão a partir da data e do km do serviço.'}
          </DialogDescription>
        </DialogHeader>

        <Field label="Moto" required>
          {(id) =>
            lockedMoto && v.motorcycleId ? (
              <div
                id={id}
                className="flex min-h-10 items-center gap-2 rounded-md border border-dashed border-input px-3 text-sm"
              >
                {(record?.motorcycle ?? preset?.motorcycle) && (
                  <Plate plate={(record?.motorcycle ?? preset!.motorcycle!).plate} />
                )}
                <span className="truncate">
                  {(record?.motorcycle ?? preset?.motorcycle)?.label}
                </span>
                {motoData && (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular">
                    {formatKm(motoData.currentKm)}
                  </span>
                )}
              </div>
            ) : (
              <MotorcycleLookup
                id={id}
                value={v.motorcycleId}
                valueLabel={v.motorcycleLabel}
                onChange={(mid, label) =>
                  setV((p) => ({
                    ...p,
                    motorcycleId: mid,
                    motorcycleLabel: label ?? null,
                    km: null,
                  }))
                }
              />
            )
          }
        </Field>

        <Field
          label="Serviços"
          required
          hint={
            typeNames.length > 1
              ? `${typeNames.length} serviços escolhidos.`
              : 'Pode escolher mais de um.'
          }
        >
          {(id) => (
            <MaintenanceTypePicker
              id={id}
              value={v.typeIds}
              onChange={(ids) => set('typeIds', ids)}
            />
          )}
        </Field>

        {!editing && (
          <div
            role="radiogroup"
            aria-label="Situação"
            className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
          >
            {STATUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={v.status === o.value}
                onClick={() => set('status', o.value)}
                className={cn(
                  'min-h-10 whitespace-nowrap rounded-md px-1 text-[13px] font-medium transition-colors sm:px-2 sm:text-sm',
                  v.status === o.value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        <FormGrid cols={2}>
          {(editing ? record?.status === 'SCHEDULED' : v.status === 'SCHEDULED') && (
            <Field label="Data agendada" required={!editing}>
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={v.scheduledFor}
                  min={editing ? undefined : today}
                  onChange={(e) => set('scheduledFor', e.target.value)}
                />
              )}
            </Field>
          )}
          {(editing ? record?.status === 'IN_PROGRESS' : v.status === 'IN_PROGRESS') && (
            <Field label="Início">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={v.startedAt}
                  max={today}
                  onChange={(e) => set('startedAt', e.target.value)}
                />
              )}
            </Field>
          )}
          {!editing && v.status === 'DONE' && (
            <Field label="Data em que foi feita" required>
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={v.completedAt}
                  max={today}
                  onChange={(e) => set('completedAt', e.target.value)}
                />
              )}
            </Field>
          )}
          <Field
            label="Quilometragem"
            required={!editing && v.status === 'DONE'}
            hint={
              motoData
                ? `Atual da moto: ${formatKm(motoData.currentKm)}.`
                : v.status === 'SCHEDULED'
                  ? 'Pode deixar em branco e informar ao concluir.'
                  : undefined
            }
          >
            {(id) => <NumberInput id={id} value={v.km} onValue={(x) => set('km', x)} suffix="km" />}
          </Field>
          <Field
            label="Oficina"
            hint={workshops.length ? 'Toque para ver as já usadas.' : undefined}
          >
            {(id) => (
              <>
                <Input
                  id={id}
                  value={v.workshop}
                  onChange={(e) => set('workshop', e.target.value)}
                  list={`${listId}-workshops`}
                  maxLength={120}
                  autoComplete="off"
                  placeholder="Onde foi/será feita"
                />
                <datalist id={`${listId}-workshops`}>
                  {workshops.slice(0, 30).map((w) => (
                    <option key={w} value={w} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          {canFinance && (
            <Field
              label="Valor"
              hint={
                v.status === 'SCHEDULED' && !editing
                  ? 'Orçamento, se já souber.'
                  : 'Peças + mão de obra.'
              }
            >
              {(id) => (
                <MoneyInput
                  id={id}
                  value={v.cost}
                  onValue={(x) => set('cost', x)}
                  placeholder="0,00"
                />
              )}
            </Field>
          )}
        </FormGrid>

        <Field label="Peças trocadas">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={v.parts}
              onChange={(e) => set('parts', e.target.value)}
              maxLength={2000}
              placeholder="Ex.: óleo 10W30 1 L, filtro de óleo"
            />
          )}
        </Field>
        <Field label="Observações">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={v.notes}
              onChange={(e) => set('notes', e.target.value)}
              maxLength={2000}
              placeholder="Uso interno (o cliente não vê)."
            />
          )}
        </Field>

        {!editing && v.status === 'IN_PROGRESS' && (
          <div className="flex items-start gap-2.5 rounded-lg border border-border p-3">
            <Checkbox
              id={`${listId}-maint`}
              checked={v.setInMaintenance}
              onCheckedChange={(x) => set('setInMaintenance', x)}
            />
            <label htmlFor={`${listId}-maint`} className="text-sm">
              <span className="block font-medium">Deixar a moto &ldquo;Em manutenção&rdquo;</span>
              <span className="block text-xs text-muted-foreground">
                {motoData?.status === 'RENTED'
                  ? 'A moto está com cliente — desmarque se o serviço for rápido e ela continuar com ele.'
                  : 'Ela sai das motos disponíveis até concluir.'}
              </span>
            </label>
          </div>
        )}

        {!editing && canDocs && (
          <div className="space-y-2">
            <p className="text-[13px] font-medium">Fotos e comprovantes</p>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT_UPLOAD}
              multiple
              className="hidden"
              onChange={(e) => pick(e.target.files)}
            />
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div
                  key={`${f.fileName}-${i}`}
                  className="relative flex size-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
                  title={`${f.fileName} · ${formatBytes(f.sizeBytes)}`}
                >
                  {f.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.previewUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <FileText className="size-6 text-muted-foreground" aria-hidden />
                  )}
                  <button
                    type="button"
                    onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                    className="absolute right-0.5 top-0.5 flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm"
                    aria-label={`Remover ${f.fileName}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={preparing || files.length >= 8}
                className="flex size-16 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input bg-muted/40 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                {preparing ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Camera className="size-5" />
                )}
                {preparing ? 'Lendo' : 'Anexar'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Foto do serviço, nota fiscal ou recibo (até 8). Fotos são reduzidas antes do envio.
            </p>
          </div>
        )}

        <FormError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || preparing}>
            {busy && <Loader2 className="animate-spin" />}
            {editing
              ? 'Salvar'
              : v.status === 'SCHEDULED'
                ? 'Agendar'
                : v.status === 'IN_PROGRESS'
                  ? 'Iniciar manutenção'
                  : 'Registrar manutenção'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
