'use client';

import { ParameterKey, parseList, parseNumberList, type ParameterDto } from '@locamania/shared';
import { Check, Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/masked-input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCatalog, useUpdateParameter } from '@/lib/queries';
import { PARAMETER_DESCRIPTION, PARAMETER_UNIT, formatParameterValue, reminderOffsetLabel } from '@/lib/settings/meta';
import { cn } from '@/lib/utils';

// ───────────────────────────── Chips de liga/desliga ─────────────────────────────

function ToggleChip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors disabled:opacity-50',
        on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-accent',
      )}
    >
      {on && <Check className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}

const BEFORE = [15, 10, 7, 5, 3, 2, 1];
const AFTER = [-1, -2, -3, -5, -7, -10, -15];

/** Marcos do lembrete: tocar liga/desliga cada dia (sem digitar "7,3,1,0,-1"). */
function ReminderOffsetsEditor({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const selected = new Set(parseNumberList(value));
  const extras = [...selected].filter((n) => !BEFORE.includes(n) && !AFTER.includes(n) && n !== 0);
  const toggle = (n: number) => {
    const next = new Set(selected);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    onChange([...next].sort((a, b) => b - a).join(','));
  };
  const row = (title: string, items: number[], label: (n: number) => string) => (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((n) => (
          <ToggleChip key={n} on={selected.has(n)} onClick={() => toggle(n)} disabled={disabled}>
            {label(n)}
          </ToggleChip>
        ))}
      </div>
    </div>
  );
  const days = (n: number) => `${Math.abs(n)} ${Math.abs(n) === 1 ? 'dia' : 'dias'}`;
  return (
    <div className="space-y-3">
      {row('Antes do vencimento', [...BEFORE, ...extras.filter((n) => n > 0)].sort((a, b) => b - a), days)}
      {row('No dia', [0], () => 'No dia do vencimento')}
      {row('Depois do vencimento (cliente em atraso)', [...AFTER, ...extras.filter((n) => n < 0)].sort((a, b) => b - a), days)}
    </div>
  );
}

/** Documentos exigidos: os tipos vêm da lista "Tipos de documento". */
function RequiredDocumentsEditor({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const { data, isLoading } = useCatalog('DOCUMENT_TYPE');
  const selected = new Set(parseList(value));
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando tipos de documento…</p>;
  const items = data ?? [];
  const known = new Set(items.map((i) => i.code));
  const unknown = [...selected].filter((c) => !known.has(c));
  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange([...next].join(','));
  };
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <ToggleChip key={i.code} on={selected.has(i.code)} onClick={() => toggle(i.code)} disabled={disabled}>
          {i.label}
        </ToggleChip>
      ))}
      {unknown.map((c) => (
        <ToggleChip key={c} on onClick={() => toggle(c)} disabled={disabled}>
          {c} (inativo)
        </ToggleChip>
      ))}
    </div>
  );
}

// ───────────────────────────── Validação ─────────────────────────────

function toNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

function validate(p: ParameterDto, draft: string): string | null {
  if (['number', 'percent', 'days', 'km'].includes(p.valueType)) {
    if (draft.trim() === '') return 'Informe um valor.';
    const n = toNumber(draft);
    if (!Number.isFinite(n)) return 'Precisa ser um número.';
    if (p.min !== null && n < p.min) return `O mínimo é ${formatParameterValue(p.valueType, String(p.min))}.`;
    if (p.max !== null && n > p.max) return `O máximo é ${formatParameterValue(p.valueType, String(p.max))}.`;
  }
  if (p.key === ParameterKey.REMINDER_OFFSETS && parseNumberList(draft).length === 0) return 'Escolha pelo menos um dia de aviso.';
  return null;
}

function same(p: ParameterDto, a: string, b: string): boolean {
  if (p.valueType === 'list') {
    const norm = (s: string) => parseList(s).sort().join(',');
    return norm(a) === norm(b);
  }
  if (['number', 'percent', 'days', 'km'].includes(p.valueType)) return toNumber(a) === toNumber(b);
  return a === b;
}

/** Texto do limite: "De 0 a 30 dias". */
function rangeText(p: ParameterDto): string | null {
  if (p.min === null && p.max === null) return null;
  const fmt = (n: number) => formatParameterValue(p.valueType, String(n));
  if (p.min !== null && p.max !== null) return `de ${fmt(p.min).replace(/\s.*$/, '')} a ${fmt(p.max)}`;
  return p.min !== null ? `mínimo ${fmt(p.min)}` : `máximo ${fmt(p.max!)}`;
}

function defaultText(p: ParameterDto, docLabels: Map<string, string>): string {
  if (p.key === ParameterKey.REMINDER_OFFSETS) {
    return parseNumberList(p.defaultValue)
      .map((n) => (n === 0 ? 'no dia' : reminderOffsetLabel(n)))
      .join(', ');
  }
  if (p.key === ParameterKey.REQUIRED_CUSTOMER_DOCUMENTS) {
    const names = parseList(p.defaultValue).map((c) => docLabels.get(c) ?? c);
    return names.length ? names.join(', ') : 'nenhum';
  }
  if (p.valueType === 'list') return parseList(p.defaultValue).length ? `${parseList(p.defaultValue).length} itens` : 'nenhum';
  return formatParameterValue(p.valueType, p.defaultValue);
}

// ───────────────────────────── Linha do parâmetro ─────────────────────────────

/**
 * Um parâmetro, salvo sozinho: o botão "Salvar" só aparece quando o valor
 * mudou; liga/desliga grava na hora. Retorno por toast + "Salvo" na linha.
 */
export function ParameterField({ parameter: p, canEdit }: { parameter: ParameterDto; canEdit: boolean }) {
  const id = useId();
  const update = useUpdateParameter();
  // Mesma consulta para todas as linhas (cache): nomes dos tipos de documento.
  const { data: docTypes } = useCatalog('DOCUMENT_TYPE');
  const docLabels = new Map((docTypes ?? []).map((d) => [d.code, d.label]));
  const [draft, setDraft] = useState(p.value);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(p.value), [p.value]);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  const dirty = !same(p, draft, p.value);
  const isDefault = same(p, p.value, p.defaultValue);
  const wide = p.valueType === 'list';
  const unit = PARAMETER_UNIT[p.valueType];

  async function save(value: string) {
    const problem = validate(p, value);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      const out = await update.mutateAsync({ key: p.key, value: p.valueType === 'percent' ? value.replace(',', '.') : value });
      setSaved(true);
      const n = parseList(out.value).length;
      const shown =
        p.key === ParameterKey.REMINDER_OFFSETS
          ? `${n} ${n === 1 ? 'aviso' : 'avisos'} por cobrança`
          : p.valueType === 'list'
            ? `${n} ${n === 1 ? 'item' : 'itens'}`
            : formatParameterValue(out.valueType, out.value);
      toast.success('Regra salva', { description: `${p.label}: ${shown}` });
    } catch (err) {
      setError(errorMessage(err));
      if (p.valueType === 'boolean') setDraft(p.value);
    } finally {
      setBusy(false);
    }
  }

  const range = rangeText(p);

  let editor: ReactNode;
  if (p.valueType === 'boolean') {
    const on = draft === 'true';
    editor = (
      <div className="flex h-10 items-center gap-3">
        <Switch
          id={id}
          checked={on}
          disabled={!canEdit || busy}
          onCheckedChange={(v) => {
            const next = v ? 'true' : 'false';
            setDraft(next);
            void save(next);
          }}
        />
        <label htmlFor={id} className="text-sm font-medium">
          {on ? 'Ligado' : 'Desligado'}
        </label>
        {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
      </div>
    );
  } else if (p.key === ParameterKey.REMINDER_OFFSETS) {
    editor = <ReminderOffsetsEditor value={draft} onChange={setDraft} disabled={!canEdit || busy} />;
  } else if (p.key === ParameterKey.REQUIRED_CUSTOMER_DOCUMENTS) {
    editor = <RequiredDocumentsEditor value={draft} onChange={setDraft} disabled={!canEdit || busy} />;
  } else if (p.valueType === 'percent') {
    editor = (
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={draft.replace('.', ',')}
          disabled={!canEdit || busy}
          onChange={(e) => {
            setDraft(e.target.value.replace(/[^\d,.]/g, '').replace('.', ','));
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && dirty && (e.preventDefault(), void save(draft))}
          className="pr-9 tabular"
          aria-invalid={!!error}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
      </div>
    );
  } else if (p.valueType === 'days' || p.valueType === 'km' || p.valueType === 'number') {
    editor = (
      <NumberInput
        id={id}
        value={draft === '' ? null : Number(draft)}
        onValue={(n) => {
          setDraft(n === null ? '' : String(n));
          setError(null);
        }}
        suffix={unit?.suffix}
        thousands={p.valueType === 'km'}
        disabled={!canEdit || busy}
        onKeyDown={(e) => e.key === 'Enter' && dirty && (e.preventDefault(), void save(draft))}
        className={unit?.suffix === 'dias' ? 'pr-12' : undefined}
        aria-invalid={!!error}
      />
    );
  } else {
    editor = (
      <Input
        id={id}
        value={draft}
        disabled={!canEdit || busy}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && dirty && (e.preventDefault(), void save(draft))}
        aria-invalid={!!error}
      />
    );
  }

  const actions = p.valueType !== 'boolean' && dirty && canEdit && (
    <div className="flex shrink-0 gap-2">
      <Button type="button" onClick={() => void save(draft)} disabled={busy}>
        {busy && <Loader2 className="animate-spin" />}
        Salvar
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        onClick={() => {
          setDraft(p.value);
          setError(null);
        }}
      >
        Desfazer
      </Button>
    </div>
  );

  return (
    <div className={cn('grid grid-cols-1 gap-3 py-4 first:pt-0 last:pb-0', !wide && 'md:grid-cols-[minmax(0,1fr)_minmax(0,300px)] md:gap-6')}>
      <div className="min-w-0 space-y-1">
        <label htmlFor={p.valueType === 'list' ? undefined : id} className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {p.label}
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success" role="status">
              <Check className="size-3.5" aria-hidden /> Salvo
            </span>
          )}
        </label>
        {(PARAMETER_DESCRIPTION[p.key] ?? p.description) && <p className="text-sm text-muted-foreground">{PARAMETER_DESCRIPTION[p.key] ?? p.description}</p>}
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>
            Padrão: {defaultText(p, docLabels)}
            {range && ` · aceita ${range}`}
          </span>
          {!isDefault && canEdit && !busy && (
            <button
              type="button"
              onClick={() => {
                if (p.valueType === 'boolean') {
                  setDraft(p.defaultValue);
                  void save(p.defaultValue);
                } else {
                  setDraft(p.defaultValue);
                  setError(null);
                }
              }}
              className="inline-flex min-h-8 items-center gap-1 font-medium text-primary hover:underline"
            >
              <RotateCcw className="size-3" aria-hidden /> Usar o padrão
            </button>
          )}
        </p>
      </div>
      <div className="min-w-0 space-y-2">
        {wide ? (
          <>
            {editor}
            {actions}
          </>
        ) : (
          <div className="flex items-start gap-2">
            <div className={cn('min-w-0 flex-1', p.valueType === 'boolean' && 'flex-none')}>{editor}</div>
            {actions}
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
