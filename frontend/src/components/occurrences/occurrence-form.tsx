'use client';

import {
  instantToYmd,
  OCCURRENCE_STATUS_LABELS,
  OCCURRENCE_STATUSES,
  OCCURRENCE_TYPE_LABELS,
  OCCURRENCE_TYPES,
  Permission,
  type ContractListItemDto,
  type CreateOccurrenceRequest,
  type OccurrenceDto,
  type OccurrenceStatus,
  type OccurrenceType,
  type UpdateOccurrenceRequest,
} from '@locamania/shared';
import { Info, Loader2, UserRoundCheck } from 'lucide-react';
import { useState } from 'react';

import { CustomerLookup, MotorcycleLookup } from '@/components/pickers/entity-lookup';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field, FormGrid, SectionCard, StickyActions } from '@/components/ui/kit';
import { MoneyInput } from '@/components/ui/masked-input';
import { SelectMenu } from '@/components/ui/select-menu';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useContract, useContracts } from '@/lib/queries';
import { cn, formatPlate, formatYmd, todayYmd } from '@/lib/utils';
import { OCCURRENCE_TYPE_ICON } from './occurrence-meta';

export interface OccurrenceFormInitial {
  type?: OccurrenceType;
  motorcycle?: { id: string; label: string } | null;
  customer?: { id: string; label: string } | null;
  contractId?: string | null;
}

type Ref = { id: string; label: string } | null;

/**
 * Quem estava com a moto na data (mesma regra da API: contrato ativo, ou
 * encerrado com devolução depois da data). `undefined` = ainda carregando.
 */
function useRenterOn(motorcycleId: string | null, date: string, enabled: boolean): ContractListItemDto | null | undefined {
  const list = useContracts({ motorcycleId: motorcycleId ?? undefined, pageSize: 50 }, enabled && !!motorcycleId);
  const candidate = list.data?.data
    .filter((c) => (c.status === 'ACTIVE' || c.status === 'ENDED') && c.startDate <= date)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const ended = useContract(candidate?.status === 'ENDED' ? candidate.id : undefined);
  if (!enabled || !motorcycleId || !date) return null;
  if (!list.data) return undefined;
  if (!candidate) return null;
  if (candidate.status === 'ACTIVE') return candidate;
  if (!ended.data) return ended.isError ? null : undefined;
  const end = ended.data.returnInspection?.returnedAt ?? (ended.data.endedAt ? instantToYmd(ended.data.endedAt) : null);
  return end && end >= date ? candidate : null;
}

/** Só os campos que mudaram — mandar tudo faria o histórico dizer que tudo foi alterado. */
function changedFields(o: OccurrenceDto, b: CreateOccurrenceRequest): UpdateOccurrenceRequest {
  const before: Record<string, unknown> = {
    type: o.type,
    status: o.status,
    occurredAt: o.occurredAt,
    motorcycleId: o.motorcycle?.id ?? null,
    customerId: o.customer?.id ?? null,
    contractId: o.contract?.id ?? null,
    description: o.description,
    amount: o.amount === null ? null : Number(o.amount).toFixed(2),
    fineNumber: o.fineNumber,
    fineDueDate: o.fineDueDate,
    notes: o.notes,
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b)) {
    const now = k === 'amount' && v !== null && v !== undefined ? Number(v).toFixed(2) : v;
    if (now !== before[k]) out[k] = v;
  }
  return out as UpdateOccurrenceRequest;
}

/** Cadastro e edição de ocorrência/multa (§22). Anexos ficam na ficha, depois de salvar. */
export function OccurrenceForm({
  occurrence,
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  occurrence?: OccurrenceDto | null;
  initial?: OccurrenceFormInitial;
  /** `changed` = só o que mudou em relação à ocorrência (edição): o histórico registra só isso. */
  onSubmit: (body: CreateOccurrenceRequest, changed: UpdateOccurrenceRequest) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const editing = !!occurrence;
  const canMoney = useCan(Permission.PAYMENTS_VIEW);
  const canContracts = useCan(Permission.CONTRACTS_VIEW);
  const today = todayYmd();

  const [type, setType] = useState<OccurrenceType>(occurrence?.type ?? initial?.type ?? 'TRAFFIC_FINE');
  const [status, setStatus] = useState<OccurrenceStatus>(occurrence?.status ?? 'OPEN');
  const [date, setDate] = useState(occurrence?.occurredAt ?? today);
  const [moto, setMoto] = useState<Ref>(
    occurrence?.motorcycle ? { id: occurrence.motorcycle.id, label: `${formatPlate(occurrence.motorcycle.plate)} · ${occurrence.motorcycle.label}` } : (initial?.motorcycle ?? null),
  );
  // Cliente "automático" = quem estava com a moto na data, até a pessoa escolher outro.
  const [autoCustomer, setAutoCustomer] = useState(!occurrence && !initial?.customer);
  const [customer, setCustomer] = useState<Ref>(occurrence?.customer ?? initial?.customer ?? null);
  const [contract, setContract] = useState<string | null | 'auto'>(occurrence ? (occurrence.contract?.id ?? null) : (initial?.contractId ?? 'auto'));
  const [description, setDescription] = useState(occurrence?.description ?? '');
  const [amount, setAmount] = useState(occurrence?.amount ?? '');
  const [fineNumber, setFineNumber] = useState(occurrence?.fineNumber ?? '');
  const [fineDueDate, setFineDueDate] = useState(occurrence?.fineDueDate ?? '');
  const [notes, setNotes] = useState(occurrence?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const renter = useRenterOn(moto?.id ?? null, date, canContracts && autoCustomer);
  const effectiveCustomer: Ref = autoCustomer ? (renter ? renter.customer : null) : customer;
  const effectiveContract =
    contract === 'auto' ? (renter && effectiveCustomer?.id === renter.customer.id ? renter.id : null) : contract;

  const contracts = useContracts({ customerId: effectiveCustomer?.id, pageSize: 50 }, canContracts && !!effectiveCustomer);
  const contractOptions = (contracts.data?.data ?? [])
    .filter((c) => !moto || c.motorcycle.id === moto.id || c.id === effectiveContract)
    .map((c) => ({ value: c.id, label: `${c.number} · ${formatPlate(c.motorcycle.plate)}`, hint: `desde ${formatYmd(c.startDate)}` }));
  if (occurrence?.contract && effectiveContract === occurrence.contract.id && !contractOptions.some((o) => o.value === occurrence.contract!.id)) {
    contractOptions.unshift({ value: occurrence.contract.id, label: occurrence.contract.number, hint: '' });
  }

  const clearError = (k: string) => errors[k] && setErrors((p) => ({ ...p, [k]: undefined }));
  // Valor: quem não vê valores cadastra, mas não edita (a API devolve nulo e apagaria o valor).
  const showAmount = canMoney || !editing;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found: Record<string, string> = {};
    if (!description.trim()) found.description = 'Descreva o que aconteceu.';
    if (!moto && !effectiveCustomer) found.moto = 'Informe a moto ou o cliente.';
    if (!date) found.date = 'Informe a data.';
    else if (date > today) found.date = 'A data não pode ser no futuro.';
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError('Confira os campos marcados.');
      return;
    }
    const isFine = type === 'TRAFFIC_FINE';
    const body: CreateOccurrenceRequest = {
      type,
      status,
      occurredAt: date,
      motorcycleId: moto?.id ?? null,
      customerId: effectiveCustomer?.id ?? null,
      contractId: effectiveContract ?? null,
      description: description.trim(),
      ...(showAmount ? { amount: amount || null } : {}),
      fineNumber: isFine ? fineNumber.trim() || null : null,
      fineDueDate: isFine ? fineDueDate || null : null,
      notes: notes.trim() || null,
    };
    setBusy(true);
    try {
      await onSubmit(body, occurrence ? changedFields(occurrence, body) : body);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  let customerHint: React.ReactNode = null;
  if (autoCustomer && moto && canContracts) {
    customerHint =
      renter === undefined ? (
        <span className="inline-flex items-center gap-1">
          <Loader2 className="size-3 animate-spin" /> Procurando quem estava com a moto…
        </span>
      ) : renter ? (
        <span className="inline-flex items-center gap-1 text-success">
          <UserRoundCheck className="size-3.5" aria-hidden /> Estava com a moto em {formatYmd(date)} ({renter.number}).
        </span>
      ) : (
        'Ninguém estava com a moto nessa data.'
      );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <SectionCard title="O que aconteceu">
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Tipo de ocorrência" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {OCCURRENCE_TYPES.map((t) => {
              const Icon = OCCURRENCE_TYPE_ICON[t];
              const active = t === type;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setType(t)}
                  className={cn(
                    'flex min-h-12 items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors',
                    active ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'border-border bg-card hover:bg-accent',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="leading-tight">{OCCURRENCE_TYPE_LABELS[t]}</span>
                </button>
              );
            })}
          </div>
          <FormGrid cols={3}>
            <Field label="Data" required error={errors.date}>
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => {
                    setDate(e.target.value);
                    clearError('date');
                  }}
                />
              )}
            </Field>
            <Field label="Situação">
              {(id) => (
                <SelectMenu
                  id={id}
                  value={status}
                  onChange={(v) => setStatus(v as OccurrenceStatus)}
                  options={OCCURRENCE_STATUSES.map((s) => ({ value: s, label: OCCURRENCE_STATUS_LABELS[s] }))}
                />
              )}
            </Field>
          </FormGrid>
        </div>
      </SectionCard>

      <SectionCard title="Moto e cliente" description="Com a moto e a data, o sistema acha quem estava com ela.">
        <FormGrid cols={canContracts ? 3 : 2}>
          <Field
            label="Moto"
            error={errors.moto}
            hint={
              moto ? (
                <button type="button" className="text-primary hover:underline" onClick={() => setMoto(null)}>
                  Remover moto
                </button>
              ) : undefined
            }
          >
            {(id) => (
              <MotorcycleLookup
                id={id}
                value={moto?.id ?? null}
                valueLabel={moto?.label}
                onChange={(v, label) => {
                  setMoto(v ? { id: v, label: label ?? '' } : null);
                  clearError('moto');
                }}
              />
            )}
          </Field>
          <Field
            label="Cliente"
            hint={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {customerHint}
                {effectiveCustomer && (
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => {
                      setAutoCustomer(false);
                      setCustomer(null);
                      setContract(null);
                    }}
                  >
                    Remover cliente
                  </button>
                )}
              </span>
            }
          >
            {(id) => (
              <CustomerLookup
                id={id}
                value={effectiveCustomer?.id ?? null}
                valueLabel={effectiveCustomer?.label}
                onChange={(v, label) => {
                  setAutoCustomer(false);
                  setCustomer(v ? { id: v, label: label ?? '' } : null);
                  setContract('auto');
                  clearError('moto');
                }}
              />
            )}
          </Field>
          {canContracts && (
            <Field label="Contrato" hint={effectiveCustomer ? 'Opcional.' : 'Escolha o cliente para ver os contratos.'}>
              {(id) => (
                <SelectMenu
                  id={id}
                  value={effectiveContract ?? ''}
                  onChange={(v) => setContract(v || null)}
                  placeholder="Sem contrato"
                  disabled={!effectiveCustomer}
                  options={contractOptions}
                />
              )}
            </Field>
          )}
        </FormGrid>
      </SectionCard>

      <SectionCard title="Detalhes">
        <div className="space-y-4">
          <Field label="Descrição" required error={errors.description}>
            {(id) => (
              <Textarea
                id={id}
                rows={3}
                value={description}
                maxLength={2000}
                onChange={(e) => {
                  setDescription(e.target.value);
                  clearError('description');
                }}
                placeholder={type === 'TRAFFIC_FINE' ? 'Ex.: excesso de velocidade na Av. Paulista.' : 'O que aconteceu, onde e como.'}
              />
            )}
          </Field>
          <FormGrid cols={3}>
            {showAmount && (
              <Field label={type === 'TRAFFIC_FINE' ? 'Valor da multa' : 'Valor (prejuízo ou custo)'} hint={!canMoney ? 'Depois de salvo, só quem vê pagamentos enxerga o valor.' : undefined}>
                {(id) => <MoneyInput id={id} value={amount} onValue={setAmount} placeholder="0,00" />}
              </Field>
            )}
            {type === 'TRAFFIC_FINE' && (
              <>
                <Field label="Nº do auto de infração">
                  {(id) => <Input id={id} value={fineNumber} onChange={(e) => setFineNumber(e.target.value.toUpperCase())} maxLength={60} autoCapitalize="characters" autoComplete="off" />}
                </Field>
                <Field label="Vencimento da multa">{(id) => <Input id={id} type="date" value={fineDueDate} onChange={(e) => setFineDueDate(e.target.value)} />}</Field>
              </>
            )}
          </FormGrid>
          <Field label="Observações" hint="Anotações internas — o cliente não vê.">
            {(id) => <Textarea id={id} rows={2} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Boletim de ocorrência, oficina, seguro…" />}
          </Field>
        </div>
      </SectionCard>

      {!editing && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Fotos, boletim e comprovantes você anexa na ficha da ocorrência, logo depois de salvar.
        </p>
      )}

      <FormError message={formError} />
      <StickyActions>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </StickyActions>
    </form>
  );
}
