'use client';

import {
  CHARGE_KIND_LABELS,
  FUEL_LEVELS,
  FUEL_LEVEL_LABELS,
  Permission,
  RETURN_CONDITION_LABELS,
  fromCents,
  toCents,
  todayYmd,
  type ChargeDto,
  type ContractDto,
  type DepositOutcome,
  type FuelLevel,
  type ReturnCondition,
  type ReturnExtraCharge,
} from '@locamania/shared';
import { ClipboardCheck, Info, Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field, FormGrid, SectionCard, StickyActions } from '@/components/ui/kit';
import { MoneyInput, NumberInput } from '@/components/ui/masked-input';
import { SelectMenu } from '@/components/ui/select-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useUploadMany } from '@/lib/contracts/queries';
import type { PreparedFile } from '@/lib/files';
import { useCharges, useMotorcycle, useReturnContract } from '@/lib/queries';
import { cn, formatBRL, formatKm, formatYmd } from '@/lib/utils';
import { ChoiceGroup } from './choice';
import { PhotoPicker } from './photo-picker';

type ExtraKind = ReturnExtraCharge['kind'];
interface Extra {
  key: number;
  kind: ExtraKind;
  description: string;
  amount: string;
  dueDate: string;
}

const CONDITION_HINT: Record<ReturnCondition, string> = {
  GOOD: 'Sem avarias',
  FAIR: 'Só o desgaste do uso',
  DAMAGED: 'Precisa de conserto',
};

/** Caução: devolver, reter parte ou reter tudo (§23). */
const DEPOSIT_OPTIONS: {
  value: Exclude<DepositOutcome, 'NONE'>;
  title: string;
  description: string;
}[] = [
  { value: 'REFUNDED', title: 'Devolver ao cliente', description: 'Nada a descontar' },
  { value: 'PARTIALLY_RETAINED', title: 'Reter uma parte', description: 'Informe o valor retido' },
  { value: 'RETAINED', title: 'Reter tudo', description: 'Cobre avarias ou pendências' },
];

const isOpen = (ch: ChargeDto) => ch.status === 'PENDING' || ch.status === 'OVERDUE';

/**
 * Devolução da moto (§23): vistoria completa e encerramento do contrato. Na
 * API, as parcelas de períodos depois da devolução são canceladas, a caução
 * retida vira receita e a moto volta para disponível ou manutenção.
 */
export function ReturnForm({ contract: c }: { contract: ContractDto }) {
  const router = useRouter();
  const confirm = useConfirm();
  const canPayments = useCan(Permission.PAYMENTS_VIEW);
  const canDocs = useCan(Permission.DOCUMENTS_MANAGE);
  const moto = useMotorcycle(c.motorcycle.id);
  const charges = useCharges({ contractId: c.id, pageSize: 100 }, canPayments);
  const doReturn = useReturnContract(c.id);
  const upload = useUploadMany();
  const today = todayYmd();

  const [returnedAt, setReturnedAt] = useState(today);
  const [finalKm, setFinalKm] = useState<number | null>(null);
  const [condition, setCondition] = useState<ReturnCondition>('GOOD');
  const [fuel, setFuel] = useState<FuelLevel | null>(null);
  const [damages, setDamages] = useState('');
  const [pending, setPending] = useState('');
  const [notes, setNotes] = useState('');
  const [nextStatus, setNextStatus] = useState<'AVAILABLE' | 'MAINTENANCE'>('AVAILABLE');
  const [statusTouched, setStatusTouched] = useState(false);
  const [deposit, setDeposit] = useState<Exclude<DepositOutcome, 'NONE'>>('REFUNDED');
  const [retained, setRetained] = useState('');
  const [extras, setExtras] = useState<Extra[]>([]);
  const [photos, setPhotos] = useState<PreparedFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const minKm = Math.max(c.initialKm ?? 0, moto.data?.currentKm ?? 0);
  useEffect(() => {
    if (finalKm === null && moto.data) setFinalKm(Math.max(moto.data.currentKm, c.initialKm ?? 0));
  }, [moto.data, c.initialKm, finalKm]);
  // Moto com avaria vai para a manutenção, a não ser que a pessoa escolha outra coisa.
  useEffect(() => {
    if (!statusTouched) setNextStatus(condition === 'DAMAGED' ? 'MAINTENANCE' : 'AVAILABLE');
  }, [condition, statusTouched]);

  // Sem `payments.view` o valor da caução vem nulo: não dá para saber, então pergunta.
  const hasDeposit = c.depositAmount !== null ? toCents(c.depositAmount) > 0 : !canPayments;

  const money = useMemo(() => {
    const rows = charges.data?.data;
    if (!rows) return null;
    const willCancel = rows.filter(
      (ch) =>
        isOpen(ch) &&
        ((ch.kind === 'RENT' && ch.periodStart !== null && ch.periodStart > returnedAt) ||
          ch.kind === 'DEPOSIT'),
    );
    const cancelIds = new Set(willCancel.map((x) => x.id));
    const stillOpen = rows.filter((ch) => isOpen(ch) && !cancelIds.has(ch.id));
    const sum = (list: ChargeDto[]) => fromCents(list.reduce((a, x) => a + toCents(x.amount), 0));
    const depositCharge = rows.find((ch) => ch.kind === 'DEPOSIT');
    return {
      stillOpen: {
        count: stillOpen.length,
        amount: sum(stillOpen),
        overdue: stillOpen.filter((x) => x.displayStatus === 'OVERDUE').length,
      },
      willCancel: {
        count: willCancel.filter((x) => x.kind === 'RENT').length,
        amount: sum(willCancel.filter((x) => x.kind === 'RENT')),
      },
      depositUnpaid: !!depositCharge && isOpen(depositCharge),
    };
  }, [charges.data, returnedAt]);
  const extrasTotal = fromCents(extras.reduce((a, e) => a + toCents(e.amount), 0));
  // Caução que nunca foi paga não se devolve nem se retém (a API cancela a cobrança dela).
  const depositUnpaid = hasDeposit && !!money?.depositUnpaid;
  const settleDeposit = hasDeposit && !depositUnpaid;

  function updateExtra(key: number, patch: Partial<Extra>) {
    setExtras((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!returnedAt) e.returnedAt = 'Informe a data.';
    else if (returnedAt > today) e.returnedAt = 'A data não pode ser no futuro.';
    else if (returnedAt < c.startDate)
      e.returnedAt = `Não pode ser antes do início (${formatYmd(c.startDate)}).`;
    if (finalKm === null) e.finalKm = 'Informe o km final.';
    else if (finalKm < minKm) e.finalKm = `Não pode ser menor que ${formatKm(minKm)}.`;
    if (condition === 'DAMAGED' && !damages.trim()) e.damages = 'Descreva as avarias.';
    if (settleDeposit && deposit === 'PARTIALLY_RETAINED') {
      if (toCents(retained) <= 0) e.retained = 'Informe quanto foi retido.';
      else if (c.depositAmount && toCents(retained) > toCents(c.depositAmount))
        e.retained = 'Não pode ser maior que a caução.';
    }
    extras.forEach((x) => {
      if (!x.description.trim()) e[`extra-${x.key}-description`] = 'Descreva.';
      if (toCents(x.amount) <= 0) e[`extra-${x.key}-amount`] = 'Informe o valor.';
    });
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return setFormError('Confira os campos marcados.');
    const ok = await confirm({
      title: `Encerrar o contrato ${c.number}?`,
      description: `A moto volta para ${nextStatus === 'AVAILABLE' ? 'Disponível' : 'Manutenção'} e as parcelas depois de ${formatYmd(returnedAt)} são canceladas. Isso não se desfaz.`,
      confirmText: 'Registrar devolução',
    });
    if (!ok) return;
    try {
      const updated = await doReturn.mutateAsync({
        returnedAt,
        finalKm: finalKm!,
        condition,
        fuelLevel: fuel,
        damages: damages.trim() || null,
        pendingItems: pending.trim() || null,
        notes: notes.trim() || null,
        nextMotorcycleStatus: nextStatus,
        depositOutcome: settleDeposit ? deposit : 'NONE',
        depositRetainedAmount: settleDeposit && deposit === 'PARTIALLY_RETAINED' ? retained : null,
        extraCharges: extras.map((x) => ({
          kind: x.kind,
          description: x.description.trim(),
          amount: x.amount,
          dueDate: x.dueDate || null,
        })),
      });
      const inspectionId = updated.returnInspection?.id;
      if (photos.length && inspectionId) {
        try {
          await upload.mutateAsync({
            files: photos,
            ownerType: 'RETURN',
            ownerId: inspectionId,
            typeCode: 'PHOTO_RETURN',
            title: `Fotos da devolução — ${c.number}`,
          });
        } catch (err) {
          toast.warning('Devolução registrada, mas as fotos não subiram', {
            description: `${errorMessage(err)} Anexe de novo na aba Devolução.`,
          });
        }
      }
      toast.success('Devolução registrada', {
        description: `Contrato encerrado. Moto ${nextStatus === 'AVAILABLE' ? 'disponível' : 'em manutenção'}.`,
      });
      router.replace(`/admin/contracts/${c.id}?tab=return`);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  const busy = doReturn.isPending || upload.isPending;
  const kmDriven = finalKm !== null && c.initialKm !== null ? finalKm - c.initialKm : null;

  const summary = (
    <SectionCard title="O que acontece ao registrar">
      <div className="space-y-3 text-sm">
        <ul className="space-y-1.5 text-muted-foreground">
          <li>• O contrato é encerrado e o cliente é avisado.</li>
          <li>
            • A moto vai para{' '}
            <strong className="font-medium text-foreground">
              {nextStatus === 'AVAILABLE' ? 'Disponível' : 'Manutenção'}
            </strong>
            {finalKm !== null && <> com {formatKm(finalKm)}</>}.
          </li>
          {settleDeposit && deposit !== 'REFUNDED' && (
            <li>• A caução retida entra como receita no financeiro.</li>
          )}
        </ul>
        {canPayments &&
          (charges.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            money && (
              <div className="space-y-2 rounded-lg bg-muted/60 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-muted-foreground">Continuam em aberto</span>
                  <span
                    className={cn(
                      'ml-auto whitespace-nowrap font-medium tabular',
                      money.stillOpen.overdue > 0 && 'text-destructive',
                    )}
                  >
                    {money.stillOpen.count
                      ? `${money.stillOpen.count} · ${formatBRL(money.stillOpen.amount)}`
                      : 'nada'}
                  </span>
                </div>
                {money.stillOpen.overdue > 0 && (
                  <p className="text-xs text-destructive">
                    {money.stillOpen.overdue} em atraso — cobre antes de liberar o cliente.
                  </p>
                )}
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-muted-foreground">Parcelas futuras canceladas</span>
                  <span className="ml-auto whitespace-nowrap font-medium tabular">
                    {money.willCancel.count
                      ? `${money.willCancel.count} · ${formatBRL(money.willCancel.amount)}`
                      : 'nenhuma'}
                  </span>
                </div>
                {extras.length > 0 && (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-muted-foreground">Novas cobranças</span>
                    <span className="ml-auto whitespace-nowrap font-medium tabular">
                      {extras.length} · {formatBRL(extrasTotal)}
                    </span>
                  </div>
                )}
                {money.depositUnpaid && (
                  <p className="text-xs text-muted-foreground">
                    A caução não foi paga: a cobrança dela é cancelada.
                  </p>
                )}
              </div>
            )
          ))}
      </div>
    </SectionCard>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 lg:grid-cols-3 lg:items-start">
      <div className="space-y-5 lg:col-span-2">
        <SectionCard title="Vistoria">
          <div className="space-y-4">
            <FormGrid>
              <Field label="Data da devolução" required error={errors.returnedAt}>
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={returnedAt}
                    min={c.startDate}
                    max={today}
                    onChange={(e) => setReturnedAt(e.target.value)}
                  />
                )}
              </Field>
              <Field
                label="Km final"
                required
                error={errors.finalKm}
                hint={
                  c.initialKm !== null
                    ? `Saiu com ${formatKm(c.initialKm)}${kmDriven !== null && kmDriven >= 0 ? ` · rodou ${formatKm(kmDriven)}` : ''}.`
                    : moto.data
                      ? `Km atual: ${formatKm(moto.data.currentKm)}.`
                      : undefined
                }
              >
                {(id) => <NumberInput id={id} value={finalKm} onValue={setFinalKm} suffix="km" />}
              </Field>
            </FormGrid>
            <div className="space-y-1.5">
              <p className="text-[13px] font-medium">Estado da moto</p>
              <ChoiceGroup
                label="Estado da moto"
                value={condition}
                onChange={setCondition}
                options={(['GOOD', 'FAIR', 'DAMAGED'] as const).map((k) => ({
                  value: k,
                  title: RETURN_CONDITION_LABELS[k],
                  description: CONDITION_HINT[k],
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[13px] font-medium">
                Combustível{' '}
                <span className="font-normal text-muted-foreground">(se aplicável)</span>
              </p>
              <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Combustível">
                {FUEL_LEVELS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={fuel === f}
                    onClick={() => setFuel((cur) => (cur === f ? null : f))}
                    className={cn(
                      'h-11 rounded-lg border px-1 text-sm font-medium transition-colors',
                      fuel === f
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card hover:bg-accent',
                    )}
                  >
                    {FUEL_LEVEL_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>
            <Field
              label="Avarias"
              required={condition === 'DAMAGED'}
              error={errors.damages}
              hint="Ex.: retrovisor esquerdo quebrado, risco no tanque."
            >
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={damages}
                  onChange={(e) => setDamages(e.target.value)}
                  maxLength={2000}
                />
              )}
            </Field>
            <Field label="Pendências" hint="Ex.: não devolveu o capacete; multa a chegar.">
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={pending}
                  onChange={(e) => setPending(e.target.value)}
                  maxLength={2000}
                />
              )}
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Cobrar do cliente"
          description="Avarias, multas ou outros valores pendentes viram cobranças avulsas."
          actions={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setExtras((l) => [
                  ...l,
                  {
                    key: Date.now(),
                    kind: condition === 'DAMAGED' ? 'DAMAGE' : 'OTHER',
                    description: '',
                    amount: '',
                    dueDate: returnedAt,
                  },
                ])
              }
            >
              <Plus /> Adicionar
            </Button>
          }
        >
          {extras.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum valor extra.</p>
          ) : (
            <ul className="space-y-3">
              {extras.map((x) => (
                <li key={x.key} className="rounded-lg border border-border p-3">
                  <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                    <Field label="Tipo">
                      {(id) => (
                        <SelectMenu
                          id={id}
                          value={x.kind}
                          onChange={(k) => updateExtra(x.key, { kind: k as ExtraKind })}
                          options={(['DAMAGE', 'FINE', 'OTHER'] as const).map((k) => ({
                            value: k,
                            label: CHARGE_KIND_LABELS[k],
                          }))}
                        />
                      )}
                    </Field>
                    <Field label="Descrição" required error={errors[`extra-${x.key}-description`]}>
                      {(id) => (
                        <Input
                          id={id}
                          value={x.description}
                          onChange={(e) => updateExtra(x.key, { description: e.target.value })}
                          maxLength={200}
                          placeholder="Ex.: troca do retrovisor"
                        />
                      )}
                    </Field>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                    <Field label="Valor" required error={errors[`extra-${x.key}-amount`]}>
                      {(id) => (
                        <MoneyInput
                          id={id}
                          value={x.amount}
                          onValue={(v) => updateExtra(x.key, { amount: v })}
                        />
                      )}
                    </Field>
                    <Field label="Vencimento">
                      {(id) => (
                        <Input
                          id={id}
                          type="date"
                          value={x.dueDate}
                          onChange={(e) => updateExtra(x.key, { dueDate: e.target.value })}
                        />
                      )}
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setExtras((l) => l.filter((e) => e.key !== x.key))}
                      aria-label="Remover cobrança"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Caução"
          description={
            c.depositAmount ? `Valor da caução: ${formatBRL(c.depositAmount)}.` : undefined
          }
        >
          {depositUnpaid ? (
            <p className="text-sm text-muted-foreground">
              A caução não foi paga pelo cliente: não há o que devolver ou reter. A cobrança dela é
              cancelada no encerramento.
            </p>
          ) : hasDeposit ? (
            <div className="space-y-3">
              <ChoiceGroup
                label="Caução"
                value={deposit}
                onChange={setDeposit}
                options={DEPOSIT_OPTIONS}
              />
              {deposit === 'PARTIALLY_RETAINED' && (
                <Field
                  label="Valor retido"
                  required
                  error={errors.retained}
                  hint={
                    c.depositAmount && toCents(retained) > 0
                      ? `Devolver ao cliente: ${formatBRL(fromCents(Math.max(0, toCents(c.depositAmount) - toCents(retained))))}`
                      : undefined
                  }
                  className="sm:max-w-xs"
                >
                  {(id) => <MoneyInput id={id} value={retained} onValue={setRetained} />}
                </Field>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Este contrato não tem caução.</p>
          )}
        </SectionCard>

        <SectionCard title="Para onde vai a moto">
          <ChoiceGroup
            label="Destino da moto"
            cols={2}
            value={nextStatus}
            onChange={(s) => {
              setStatusTouched(true);
              setNextStatus(s);
            }}
            options={[
              {
                value: 'AVAILABLE',
                title: 'Disponível',
                description: 'Pronta para o próximo aluguel',
              },
              {
                value: 'MAINTENANCE',
                title: 'Manutenção',
                description: 'Revisão ou conserto antes de alugar',
              },
            ]}
          />
        </SectionCard>

        <SectionCard title="Fotos e observações">
          <div className="space-y-4">
            {canDocs && (
              <Field label="Fotos da moto na devolução">
                {() => <PhotoPicker files={photos} onChange={setPhotos} disabled={busy} />}
              </Field>
            )}
            <Field label="Observações">
              {(id) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={2000}
                />
              )}
            </Field>
          </div>
        </SectionCard>

        <div className="lg:hidden">{summary}</div>

        <FormError message={formError} />
        <StickyActions>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/admin/contracts/${c.id}`)}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || moto.isLoading}>
            {busy ? <Loader2 className="animate-spin" /> : <ClipboardCheck />} Registrar devolução
          </Button>
        </StickyActions>
      </div>
      <aside className="hidden space-y-5 lg:sticky lg:top-24 lg:block">
        {summary}
        <p className="flex gap-2 px-1 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" /> Multas que ainda vão chegar podem ser
          lançadas depois, em Ocorrências e multas.
        </p>
      </aside>
    </form>
  );
}
