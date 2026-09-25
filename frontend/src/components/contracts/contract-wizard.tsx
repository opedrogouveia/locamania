'use client';

import {
  PERIODICITY_LABELS,
  PERIODICITY_UNIT,
  Permission,
  addDays,
  formatCpf,
  formatKm,
  formatPhone,
  formatPlate,
  rentalBlockers,
  toCents,
  todayYmd,
  type CustomerDto,
  type MotorcycleListItemDto,
  type PaymentPeriodicity,
  type Ymd,
} from '@locamania/shared';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bike,
  CalendarRange,
  Check,
  CheckCircle2,
  FileSignature,
  Loader2,
  Pencil,
  Search,
  UserPlus,
  Wrench,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { CustomerLookup } from '@/components/pickers/entity-lookup';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { DetailList, Field, FormGrid, SectionCard, StickyActions } from '@/components/ui/kit';
import { MoneyInput } from '@/components/ui/masked-input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CustomerStatusBadge,
  ExpiryBadge,
  MotorcycleStatusBadge,
} from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { ApiError, errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import {
  DURATION_PRESETS,
  durationLabel,
  endDateForMonths,
  firstPeriodEnd,
  validateConditions,
  type ConditionsErrors,
} from '@/lib/contracts/rules';
import {
  useContracts,
  useCreateContract,
  useCustomer,
  useMotorcycle,
  useMotorcycles,
} from '@/lib/queries';
import { useUrlState } from '@/lib/use-url-state';
import { cn, formatBRL, formatYmd } from '@/lib/utils';
import { ChoiceCard, ChoiceGroup } from './choice';
import { SchedulePreview, type SchedulePreviewInput } from './schedule-preview';

const STEPS = ['Cliente', 'Moto', 'Condições', 'Revisão'] as const;

const PERIODICITY_HINT: Record<PaymentPeriodicity, string> = {
  WEEKLY: 'a cada 7 dias',
  BIWEEKLY: 'a cada 14 dias',
  MONTHLY: 'mesmo dia do mês',
};

interface Values {
  customerId: string | null;
  customerLabel: string | null;
  motorcycleId: string | null;
  periodicity: PaymentPeriodicity;
  rentAmount: string;
  depositAmount: string;
  startDate: Ymd;
  /** Duração pronta em meses; `null` = término escolhido à mão. */
  durationMonths: number | null;
  customEndDate: Ymd;
  dueMode: 'start' | 'custom';
  customFirstDue: Ymd;
  rules: string;
  notes: string;
}

function initialValues(): Values {
  return {
    customerId: null,
    customerLabel: null,
    motorcycleId: null,
    periodicity: 'WEEKLY',
    rentAmount: '',
    depositAmount: '',
    startDate: todayYmd(),
    durationMonths: 6,
    customEndDate: '',
    dueMode: 'start',
    customFirstDue: '',
    rules: '',
    notes: '',
  };
}

function endDateOf(v: Values): Ymd {
  return v.durationMonths ? endDateForMonths(v.startDate, v.durationMonths) : v.customEndDate;
}
function firstDueOf(v: Values): Ymd {
  return v.dueMode === 'start' ? v.startDate : v.customFirstDue;
}

// ───────────────────────────── Indicador de passos ─────────────────────────────

function WizardSteps({
  step,
  maxReached,
  onGo,
}: {
  step: number;
  maxReached: number;
  onGo: (s: number) => void;
}) {
  return (
    <nav aria-label="Passos do novo aluguel">
      {/* Celular: compacto, com barra de progresso */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">{STEPS[step]}</p>
          <p className="text-xs text-muted-foreground">
            Passo {step + 1} de {STEPS.length}
          </p>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn('h-1.5 rounded-full', i <= step ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>
      </div>
      {/* Tablet/desktop: passos numerados, os já vistos são clicáveis */}
      <ol className="hidden items-center gap-2 sm:flex">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          const clickable = i <= maxReached && !current;
          return (
            <li key={s} className="flex flex-1 items-center gap-2 last:flex-none">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onGo(i)}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-lg py-1 pr-2 text-sm font-medium transition-colors',
                  clickable && 'hover:text-primary',
                  !clickable && !current && 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm tabular',
                    current && 'border-primary bg-primary text-primary-foreground',
                    done && 'border-primary bg-primary/10 text-primary',
                    !current && !done && 'border-border bg-card',
                  )}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                {s}
              </button>
              {i < STEPS.length - 1 && (
                <span
                  className={cn('h-px flex-1', i < step ? 'bg-primary/40' : 'bg-border')}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ───────────────────────────── Passo 1: cliente ─────────────────────────────

interface CustomerCheck {
  blockers: { text: string; href?: string; linkLabel?: string }[];
  warnings: string[];
}

function useCustomerCheck(
  customer: CustomerDto | undefined,
  openContract: { id: string; number: string; status: string } | null,
): CustomerCheck {
  return useMemo(() => {
    if (!customer) return { blockers: [], warnings: [] };
    const edit = { href: `/admin/customers/${customer.id}/edit`, linkLabel: 'Completar cadastro' };
    // Mesmas regras da API (rentalBlockers + categoria A), com o atalho para resolver.
    const blockers: CustomerCheck['blockers'] = rentalBlockers({
      status: customer.status,
      cnhExpiresAt: customer.cnhExpiresAt,
      today: todayYmd(),
    }).map((text) =>
      text.includes('atraso')
        ? {
            text,
            href: `/admin/customers/${customer.id}?tab=payments`,
            linkLabel: 'Ver pagamentos',
          }
        : text.includes('CNH')
          ? { text, ...edit }
          : { text },
    );
    if (!customer.cnhCategory) blockers.push({ text: 'Categoria da CNH não informada.', ...edit });
    else if (!customer.cnhCategory.includes('A'))
      blockers.push({
        text: `A CNH é categoria ${customer.cnhCategory} — para moto precisa ser A.`,
        ...edit,
      });
    if (openContract) {
      blockers.push({
        text: `Já tem o contrato ${openContract.number} ${openContract.status === 'DRAFT' ? 'em rascunho' : 'ativo'}.`,
        href: `/admin/contracts/${openContract.id}`,
        linkLabel: 'Abrir contrato',
      });
    }
    const warnings: string[] = [];
    const missing = customer.documentsChecklist.filter((d) => !d.delivered).map((d) => d.label);
    if (missing.length) warnings.push(`Documentos pendentes: ${missing.join(', ')}.`);
    if (!customer.phone && !customer.whatsapp)
      warnings.push(
        'Sem celular/WhatsApp cadastrado — não dá para mandar o contrato nem os avisos por mensagem.',
      );
    return { blockers, warnings };
  }, [customer, openContract]);
}

function CustomerCard({ c, check }: { c: CustomerDto; check: CustomerCheck }) {
  const delivered = c.documentsChecklist.filter((d) => d.delivered).length;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Avatar name={c.name} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{c.name}</p>
          <p className="text-sm text-muted-foreground tabular">
            CPF {formatCpf(c.cpf)}
            {c.phone && ` · ${formatPhone(c.phone)}`}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <CustomerStatusBadge status={c.status} />
            {c.inCollection && <Badge variant="destructive">Em cobrança</Badge>}
            {c.portalEnabled && <Badge variant="outline">Usa o app</Badge>}
          </div>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link href={`/admin/customers/${c.id}`} target="_blank">
            Ver ficha
          </Link>
        </Button>
      </div>
      <DetailList
        cols={3}
        items={[
          {
            label: 'CNH',
            value: c.cnhNumber
              ? `${c.cnhNumber}${c.cnhCategory ? ` · cat. ${c.cnhCategory}` : ''}`
              : c.cnhCategory
                ? `Categoria ${c.cnhCategory}`
                : null,
          },
          {
            label: 'Validade da CNH',
            value: c.cnhExpiresAt ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                {formatYmd(c.cnhExpiresAt)} <ExpiryBadge state={c.cnhState} />
              </span>
            ) : null,
          },
          {
            label: 'Documentos entregues',
            value: `${delivered} de ${c.documentsChecklist.length}`,
          },
        ]}
      />
      {check.blockers.length > 0 ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/8 p-3" role="alert">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <XCircle className="size-4 shrink-0" /> Este cliente não pode alugar agora
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {check.blockers.map((b) => (
              <li key={b.text} className="flex flex-wrap items-center gap-x-2">
                <span>• {b.text}</span>
                {b.href && (
                  <Link
                    href={b.href}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {b.linkLabel}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm font-medium text-success">
          <CheckCircle2 className="size-4 shrink-0" /> Cliente apto para alugar
        </p>
      )}
      {check.warnings.length > 0 && (
        <ul className="space-y-1.5 rounded-lg bg-warning/10 p-3 text-sm">
          {check.warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────────── Passo 2: moto ─────────────────────────────

function MotoOption({
  m,
  selected,
  onSelect,
}: {
  m: MotorcycleListItemDto;
  selected: boolean;
  onSelect: () => void;
}) {
  const soon = m.maintenanceDue !== 'OK' && m.nextMaintenance;
  return (
    <ChoiceCard
      selected={selected}
      onSelect={onSelect}
      title={
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono tracking-wide">{formatPlate(m.plate)}</span>
          <span className="font-normal">{m.label}</span>
        </span>
      }
      description={
        <span className="flex flex-col gap-0.5">
          <span>{[m.modelYear, m.color, formatKm(m.currentKm)].filter(Boolean).join(' · ')}</span>
          {soon && (
            <span
              className={cn(
                'inline-flex items-center gap-1',
                m.maintenanceDue === 'OVERDUE' ? 'text-destructive' : 'text-warning',
              )}
            >
              <Wrench className="size-3" />{' '}
              {m.maintenanceDue === 'OVERDUE' ? 'Manutenção vencida' : 'Manutenção próxima'}:{' '}
              {m.nextMaintenance!.typeName}
            </span>
          )}
          {m.idleDays !== null && m.idleDays >= 7 && <span>Parada há {m.idleDays} dias</span>}
        </span>
      }
    />
  );
}

function MotoStep({
  value,
  onChange,
  preset,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  preset: MotorcycleListItemDto | undefined;
}) {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isLoading, error } = useMotorcycles({
    status: 'AVAILABLE',
    search: term || undefined,
    pageSize: 60,
  });
  const rows = data?.data ?? [];
  const selectedOutside =
    preset && value === preset.id && !rows.some((r) => r.id === preset.id) ? preset : null;

  return (
    <SectionCard
      title="Qual moto?"
      description="Só aparecem as motos disponíveis. Ao criar o contrato, ela fica reservada para este cliente."
    >
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por placa ou modelo"
            aria-label="Buscar moto por placa ou modelo"
            className="pl-9"
            type="search"
          />
        </div>
        {selectedOutside && <MotoOption m={selectedOutside} selected onSelect={() => undefined} />}
        {error ? (
          <p className="text-sm text-destructive">{errorMessage(error)}</p>
        ) : isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Bike}
            title={term ? 'Nenhuma moto disponível com essa busca' : 'Nenhuma moto disponível'}
            description={
              term
                ? 'Tente outra placa ou modelo.'
                : 'Todas as motos estão alugadas, reservadas ou em manutenção.'
            }
            className="py-8"
          />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {data!.total} {data!.total === 1 ? 'moto disponível' : 'motos disponíveis'}
              {data!.total > rows.length && ` · mostrando ${rows.length}, use a busca`}
            </p>
            <div
              role="radiogroup"
              aria-label="Moto"
              className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3"
            >
              {rows.map((m) => (
                <MotoOption
                  key={m.id}
                  m={m}
                  selected={m.id === value}
                  onSelect={() => onChange(m.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}

// ───────────────────────────── Passo 3: condições ─────────────────────────────

function ConditionsStep({
  v,
  set,
  errors,
}: {
  v: Values;
  set: <K extends keyof Values>(k: K, value: Values[K]) => void;
  errors: ConditionsErrors;
}) {
  const endDate = endDateOf(v);
  const unit = PERIODICITY_UNIT[v.periodicity];
  const today = todayYmd();
  return (
    <div className="space-y-5">
      <SectionCard title="Valor e forma de pagamento">
        <div className="space-y-4">
          <ChoiceGroup
            label="Periodicidade"
            compact
            value={v.periodicity}
            onChange={(p) => set('periodicity', p)}
            options={(['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const).map((p) => ({
              value: p,
              title: PERIODICITY_LABELS[p],
              description: PERIODICITY_HINT[p],
            }))}
          />
          <FormGrid>
            <Field label={`Valor por ${unit}`} required error={errors.rentAmount}>
              {(id) => (
                <MoneyInput
                  id={id}
                  value={v.rentAmount}
                  onValue={(x) => set('rentAmount', x)}
                  placeholder="0,00"
                />
              )}
            </Field>
            <Field label="Caução" hint="Cobrada no início. Deixe em branco se não houver.">
              {(id) => (
                <MoneyInput
                  id={id}
                  value={v.depositAmount}
                  onValue={(x) => set('depositAmount', x)}
                  placeholder="0,00"
                />
              )}
            </Field>
          </FormGrid>
        </div>
      </SectionCard>

      <SectionCard title="Período do aluguel">
        <div className="space-y-4">
          <FormGrid>
            <Field label="Início" required error={errors.startDate}>
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={v.startDate}
                  min={addDays(today, -60)}
                  onChange={(e) => set('startDate', e.target.value)}
                />
              )}
            </Field>
            {v.durationMonths === null && (
              <Field label="Término" required error={errors.endDate}>
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={v.customEndDate}
                    min={v.startDate ? addDays(v.startDate, 1) : undefined}
                    onChange={(e) => set('customEndDate', e.target.value)}
                  />
                )}
              </Field>
            )}
          </FormGrid>
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">Duração</p>
            <div
              className="grid grid-cols-3 gap-2 sm:grid-cols-5"
              role="radiogroup"
              aria-label="Duração"
            >
              {[
                ...DURATION_PRESETS.map((d) => ({
                  key: String(d.months),
                  label: d.label,
                  months: d.months as number | null,
                })),
                { key: 'custom', label: 'Outra data', months: null },
              ].map((d) => {
                const active = v.durationMonths === d.months;
                return (
                  <button
                    key={d.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      if (d.months === null && v.durationMonths !== null)
                        set('customEndDate', endDateOf(v));
                      set('durationMonths', d.months);
                    }}
                    className={cn(
                      'h-11 rounded-lg border px-2 text-sm font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card hover:bg-accent',
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            {endDate && v.startDate && endDate > v.startDate ? (
              <p className="flex items-center gap-2 pt-1 text-sm">
                <CalendarRange className="size-4 text-muted-foreground" />
                <span>
                  {formatYmd(v.startDate)} a{' '}
                  <strong className="font-semibold">{formatYmd(endDate)}</strong>
                  <span className="text-muted-foreground">
                    {' '}
                    · {durationLabel(v.startDate, endDate)}
                  </span>
                </span>
              </p>
            ) : (
              errors.endDate &&
              v.durationMonths !== null && (
                <p className="text-xs text-destructive">{errors.endDate}</p>
              )
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">1º vencimento</p>
            <ChoiceGroup
              label="1º vencimento"
              cols={2}
              value={v.dueMode}
              onChange={(m) => {
                if (m === 'custom' && !v.customFirstDue) set('customFirstDue', v.startDate);
                set('dueMode', m);
              }}
              options={[
                {
                  value: 'start',
                  title: 'No início do aluguel',
                  description: `Paga antes de usar — ${formatYmd(v.startDate)}`,
                },
                { value: 'custom', title: 'Outra data', description: 'Dentro do primeiro período' },
              ]}
            />
            {v.dueMode === 'custom' && (
              <Field
                label="Data do 1º vencimento"
                error={errors.firstDueDate}
                hint={
                  v.startDate
                    ? `Entre ${formatYmd(v.startDate)} e ${formatYmd(firstPeriodEnd(v.startDate, v.periodicity))}.`
                    : undefined
                }
              >
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={v.customFirstDue}
                    min={v.startDate}
                    max={v.startDate ? firstPeriodEnd(v.startDate, v.periodicity) : undefined}
                    onChange={(e) => set('customFirstDue', e.target.value)}
                    className="sm:max-w-xs"
                  />
                )}
              </Field>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Regras e observações"
        description="Os dois textos entram no contrato que o cliente assina."
      >
        <div className="space-y-4">
          <Field
            label="Regras específicas"
            hint="Ex.: uso só para entregas; troca de óleo a cada 3.000 km na oficina indicada."
          >
            {(id) => (
              <Textarea
                id={id}
                rows={3}
                value={v.rules}
                onChange={(e) => set('rules', e.target.value)}
                maxLength={4000}
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
                maxLength={4000}
              />
            )}
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

// ───────────────────────────── Resumo (lateral / revisão) ─────────────────────────────

function SummaryLine({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: ReactNode;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm">{value}</div>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary hover:bg-accent"
        >
          <Pencil className="size-3.5" /> Alterar
        </button>
      )}
    </div>
  );
}

// ───────────────────────────── Assistente ─────────────────────────────

/**
 * Novo aluguel (§10, §39): Cliente → Moto → Condições → Revisão. Cria o
 * contrato em rascunho e reserva a moto; assinatura e entrega vêm na ficha.
 */
export function ContractWizard() {
  const router = useRouter();
  const canManage = useCan(Permission.CONTRACTS_MANAGE);
  const [url, , ready] = useUrlState({ customerId: '', motorcycleId: '' });
  const [v, setV] = useState<Values>(initialValues);
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [presetCheck, setPresetCheck] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const create = useCreateContract();

  // Vindo da ficha do cliente (?customerId=) ou da moto (?motorcycleId=).
  useEffect(() => {
    if (!ready) return;
    setV((p) => ({
      ...p,
      customerId: url.customerId || null,
      motorcycleId: url.motorcycleId || null,
    }));
    const start = url.customerId ? (url.motorcycleId ? 2 : 1) : 0;
    setStep(start);
    setMaxReached(start);
    setPresetCheck(start > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const set = <K extends keyof Values>(k: K, value: Values[K]) =>
    setV((p) => ({ ...p, [k]: value }));

  const customer = useCustomer(v.customerId ?? undefined);
  const openContracts = useContracts(
    { customerId: v.customerId ?? undefined, pageSize: 10 },
    !!v.customerId,
  );
  const openContract = useMemo(() => {
    const c = openContracts.data?.data.find((x) => x.status === 'DRAFT' || x.status === 'ACTIVE');
    return c ? { id: c.id, number: c.number, status: c.status } : null;
  }, [openContracts.data]);
  const check = useCustomerCheck(customer.data, openContract);
  const moto = useMotorcycle(v.motorcycleId ?? undefined);

  const endDate = endDateOf(v);
  const firstDue = firstDueOf(v);
  const conditionErrors = validateConditions(
    {
      startDate: v.startDate,
      endDate,
      firstDueDate: firstDue,
      periodicity: v.periodicity,
      rentAmount: v.rentAmount,
      depositAmount: v.depositAmount,
    },
    todayYmd(),
  );
  // Antes de tentar avançar, só as datas incoerentes aparecem (valor vazio não é "erro" ainda).
  const liveErrors: ConditionsErrors = {
    ...(conditionErrors.startDate && v.startDate ? { startDate: conditionErrors.startDate } : {}),
    ...(conditionErrors.endDate && endDate ? { endDate: conditionErrors.endDate } : {}),
    ...(conditionErrors.firstDueDate && v.dueMode === 'custom'
      ? { firstDueDate: conditionErrors.firstDueDate }
      : {}),
  };
  const preview: SchedulePreviewInput = useMemo(
    () => ({
      startDate: v.startDate,
      endDate,
      firstDueDate: firstDue,
      periodicity: v.periodicity,
      rentAmount: v.rentAmount,
      depositAmount: v.depositAmount,
    }),
    [v.startDate, endDate, firstDue, v.periodicity, v.rentAmount, v.depositAmount],
  );

  const customerReady = !!customer.data && !openContracts.isLoading;
  const motoProblem =
    moto.data && moto.data.status !== 'AVAILABLE'
      ? `Esta moto está ${moto.data.status === 'RESERVED' ? 'reservada' : moto.data.status === 'RENTED' ? 'alugada' : 'indisponível'} — escolha uma disponível.`
      : null;
  const stepOk = [
    !!v.customerId && customerReady && check.blockers.length === 0,
    !!v.motorcycleId && !!moto.data && !motoProblem,
    Object.keys(conditionErrors).length === 0,
    true,
  ];

  // Veio pulando passos pela URL: se o cliente não pode alugar ou a moto não
  // está disponível, volta para o passo do problema (uma vez, ao carregar).
  useEffect(() => {
    if (!presetCheck || !customerReady || (v.motorcycleId && !moto.data)) return;
    setPresetCheck(false);
    if (check.blockers.length) {
      setStep(0);
      setMaxReached(0);
    } else if (step === 2 && motoProblem) {
      setStep(1);
      setMaxReached(1);
    }
  }, [presetCheck, customerReady, moto.data, v.motorcycleId, check.blockers.length, motoProblem, step]);

  function go(next: number) {
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
    setShowErrors(false);
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function onNext() {
    if (!stepOk[step]) {
      setShowErrors(true);
      setFormError(
        step === 0
          ? !v.customerId
            ? 'Escolha o cliente.'
            : check.blockers.length
              ? 'Este cliente não pode alugar agora (veja o motivo acima).'
              : 'Carregando o cliente...'
          : step === 1
            ? (motoProblem ?? 'Escolha a moto.')
            : 'Confira os campos marcados.',
      );
      return;
    }
    go(step + 1);
  }

  async function submit() {
    setFormError(null);
    if (!stepOk[0]) return go(0);
    if (!stepOk[1]) return go(1);
    if (!stepOk[2]) return go(2);
    try {
      const c = await create.mutateAsync({
        customerId: v.customerId!,
        motorcycleId: v.motorcycleId!,
        startDate: v.startDate,
        endDate,
        firstDueDate: firstDue,
        periodicity: v.periodicity,
        rentAmount: v.rentAmount,
        depositAmount: v.depositAmount || null,
        rules: v.rules.trim() || null,
        notes: v.notes.trim() || null,
      });
      toast.success(`Contrato ${c.number} criado`, {
        description: 'A moto ficou reservada. Próximo passo: assinatura.',
      });
      router.replace(`/admin/contracts/${c.id}`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === 'MOTORCYCLE_TAKEN') go(1);
      else if (code === 'CUSTOMER_HAS_CONTRACT' || code === 'RENTAL_BLOCKED') go(0);
      setFormError(errorMessage(err));
    }
  }

  if (!canManage) {
    return (
      <EmptyState
        icon={FileSignature}
        title="Sem permissão para criar contratos"
        description="Peça a quem administra o sistema para liberar “Criar e alterar contratos”."
      />
    );
  }
  if (!ready) return <Skeleton className="h-96 w-full" />;

  const c = customer.data;
  const m = moto.data;
  const customerLine = c ? (
    <span>
      <span className="font-medium">{c.name}</span>
      <span className="block text-xs text-muted-foreground tabular">CPF {formatCpf(c.cpf)}</span>
    </span>
  ) : v.customerId ? (
    <Skeleton className="h-9 w-40" />
  ) : (
    <span className="text-muted-foreground">Não escolhido</span>
  );
  const motoLine = m ? (
    <span>
      <span className="font-mono font-medium tracking-wide">{formatPlate(m.plate)}</span> {m.label}
      <span className="block text-xs text-muted-foreground">{formatKm(m.currentKm)}</span>
    </span>
  ) : v.motorcycleId ? (
    <Skeleton className="h-9 w-40" />
  ) : (
    <span className="text-muted-foreground">Não escolhida</span>
  );
  const conditionsLine =
    toCents(v.rentAmount) > 0 ? (
      <span>
        <span className="font-medium">
          {formatBRL(v.rentAmount)} por {PERIODICITY_UNIT[v.periodicity]}
        </span>
        <span className="block text-xs text-muted-foreground tabular">
          {formatYmd(v.startDate)} a {formatYmd(endDate)}
          {v.depositAmount && ` · caução ${formatBRL(v.depositAmount)}`}
        </span>
      </span>
    ) : (
      <span className="text-muted-foreground">A definir</span>
    );

  return (
    <div className="space-y-5">
      <WizardSteps step={step} maxReached={maxReached} onGo={go} />

      {step > 0 && c && check.blockers.length > 0 && (
        <div
          className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <span className="flex items-center gap-2 text-destructive">
            <XCircle className="size-4 shrink-0" /> {c.name} não pode alugar agora:{' '}
            {check.blockers.map((b) => b.text).join(' ')}
          </span>
          <Button variant="outline" size="sm" onClick={() => go(0)}>
            Ver detalhes
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        <div className="space-y-5 lg:col-span-2">
          {step === 0 && (
            <SectionCard
              title="Quem vai alugar?"
              description="Busque pelo nome, CPF ou telefone."
              actions={
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/customers/new">
                    <UserPlus /> <span className="hidden sm:inline">Novo cliente</span>
                    <span className="sm:hidden">Novo</span>
                  </Link>
                </Button>
              }
            >
              <div className="space-y-4">
                <CustomerLookup
                  value={v.customerId}
                  valueLabel={v.customerLabel ?? c?.name ?? null}
                  onChange={(id, label) =>
                    setV((p) => ({ ...p, customerId: id, customerLabel: label ?? null }))
                  }
                />
                {v.customerId &&
                  (customer.isLoading ? (
                    <Skeleton className="h-40 w-full" />
                  ) : customer.error ? (
                    <p className="text-sm text-destructive">{errorMessage(customer.error)}</p>
                  ) : (
                    c && <CustomerCard c={c} check={check} />
                  ))}
                {!v.customerId && (
                  <p className="text-sm text-muted-foreground">
                    Cliente novo? Cadastre primeiro — na ficha dele tem o botão{' '}
                    <strong className="font-medium text-foreground">Novo aluguel</strong>, que volta
                    para cá.
                  </p>
                )}
              </div>
            </SectionCard>
          )}

          {step === 1 && (
            <>
              <MotoStep
                value={v.motorcycleId}
                onChange={(id) => set('motorcycleId', id)}
                preset={m}
              />
              {motoProblem && m && (
                <p className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm">
                  <AlertTriangle className="size-4 shrink-0 text-warning" /> {formatPlate(m.plate)}:{' '}
                  <MotorcycleStatusBadge status={m.status} /> {motoProblem}
                </p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <ConditionsStep v={v} set={set} errors={showErrors ? conditionErrors : liveErrors} />
              <SectionCard
                title="Prévia do cronograma"
                description="Calculada com a mesma regra da cobrança. As cobranças são geradas na entrega da moto."
                className="lg:hidden"
              >
                <SchedulePreview input={preview} />
              </SectionCard>
            </>
          )}

          {step === 3 && (
            <>
              <SectionCard title="Confira antes de criar">
                <div className="divide-y divide-border">
                  <SummaryLine label="Cliente" value={customerLine} onEdit={() => go(0)} />
                  <SummaryLine label="Moto" value={motoLine} onEdit={() => go(1)} />
                  <SummaryLine
                    label="Condições"
                    onEdit={() => go(2)}
                    value={
                      <DetailList
                        className="mt-1.5 grid-cols-2"
                        items={[
                          { label: 'Periodicidade', value: PERIODICITY_LABELS[v.periodicity] },
                          {
                            label: `Valor por ${PERIODICITY_UNIT[v.periodicity]}`,
                            value: formatBRL(v.rentAmount),
                          },
                          {
                            label: 'Período',
                            value: `${formatYmd(v.startDate)} a ${formatYmd(endDate)} (${durationLabel(v.startDate, endDate)})`,
                          },
                          { label: '1º vencimento', value: formatYmd(firstDue) },
                          {
                            label: 'Caução',
                            value: v.depositAmount ? formatBRL(v.depositAmount) : 'Sem caução',
                          },
                          {
                            label: 'Km de saída',
                            value: m ? `${formatKm(m.currentKm)} (confirmado na entrega)` : null,
                          },
                        ]}
                      />
                    }
                  />
                  {(v.rules.trim() || v.notes.trim()) && (
                    <SummaryLine
                      label="Regras e observações"
                      onEdit={() => go(2)}
                      value={
                        <div className="space-y-1.5 whitespace-pre-line">
                          {v.rules.trim() && <p>{v.rules.trim()}</p>}
                          {v.notes.trim() && (
                            <p className="text-muted-foreground">{v.notes.trim()}</p>
                          )}
                        </div>
                      }
                    />
                  )}
                </div>
                {c?.cnhExpiresAt && c.cnhExpiresAt < endDate && (
                  <p className="mt-3 flex gap-2 rounded-lg bg-warning/10 p-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />A CNH do
                    cliente vence em {formatYmd(c.cnhExpiresAt)}, antes do fim do contrato. O
                    sistema avisa perto da data.
                  </p>
                )}
              </SectionCard>
              <SectionCard title="Cronograma de pagamentos" className="lg:hidden">
                <SchedulePreview input={preview} head={4} />
              </SectionCard>
              <SectionCard title="Depois de criar">
                <ol className="space-y-3 text-sm">
                  {[
                    ['Rascunho', 'O contrato é gerado e a moto fica reservada para este cliente.'],
                    [
                      'Assinatura',
                      c?.portalEnabled
                        ? 'Imprima e registre a assinatura presencial, ou envie para o cliente aceitar no app.'
                        : 'Imprima o contrato e registre a assinatura presencial.',
                    ],
                    [
                      'Entrega',
                      'Confirme o km de saída: a moto passa para Alugada e as cobranças começam, com lembretes automáticos.',
                    ],
                  ].map(([t, d], i) => (
                    <li key={t} className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {i + 1}
                      </span>
                      <span>
                        <strong className="font-medium">{t}.</strong>{' '}
                        <span className="text-muted-foreground">{d}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </SectionCard>
            </>
          )}

          <FormError message={formError} />
          <StickyActions>
            {step === 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/contracts')}
              >
                Cancelar
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => go(step - 1)}>
                <ArrowLeft /> Voltar
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" onClick={onNext}>
                Continuar <ArrowRight />
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="animate-spin" /> : <FileSignature />}
                Criar contrato
              </Button>
            )}
          </StickyActions>
        </div>

        {/* Resumo lateral (desktop) */}
        <aside className="hidden space-y-5 lg:sticky lg:top-24 lg:block">
          <SectionCard title="Resumo">
            <div className="divide-y divide-border">
              <SummaryLine
                label="Cliente"
                value={customerLine}
                onEdit={step > 0 ? () => go(0) : undefined}
              />
              <SummaryLine
                label="Moto"
                value={motoLine}
                onEdit={step > 1 ? () => go(1) : undefined}
              />
              <SummaryLine
                label="Condições"
                value={conditionsLine}
                onEdit={step > 2 ? () => go(2) : undefined}
              />
            </div>
          </SectionCard>
          {step >= 2 && (
            <SectionCard
              title="Prévia do cronograma"
              description="As cobranças são geradas na entrega da moto."
            >
              <SchedulePreview input={preview} head={step === 3 ? 5 : 3} />
            </SectionCard>
          )}
        </aside>
      </div>
    </div>
  );
}
