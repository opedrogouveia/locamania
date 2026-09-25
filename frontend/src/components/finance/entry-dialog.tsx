'use client';

import {
  CatalogGroup,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  formatPlate,
  type FinancialEntryDto,
  type FinancialEntryType,
  type PaymentMethod,
} from '@locamania/shared';
import { Archive, ArrowDownLeft, ArrowUpRight, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { MotorcycleLookup } from '@/components/pickers/entity-lookup';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/kit';
import { MoneyInput } from '@/components/ui/masked-input';
import { SelectMenu } from '@/components/ui/select-menu';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useArchiveEntry, useCatalog, useCreateEntry, useUpdateEntry } from '@/lib/queries';
import { cn, formatBRL, todayYmd } from '@/lib/utils';

type Moto = { id: string; label: string } | null;

function EntryForm({ entry, onDone }: { entry: FinancialEntryDto | null; onDone: () => void }) {
  const create = useCreateEntry();
  const update = useUpdateEntry();
  const archive = useArchiveEntry();
  const confirm = useConfirm();
  const [type, setType] = useState<FinancialEntryType>(entry?.type ?? 'EXPENSE');
  const [category, setCategory] = useState(entry?.categoryCode ?? '');
  const [amount, setAmount] = useState(entry?.amount ?? '');
  const [date, setDate] = useState(entry?.date ?? todayYmd());
  const [description, setDescription] = useState(entry?.description ?? '');
  const [moto, setMoto] = useState<Moto>(entry?.motorcycle ? { id: entry.motorcycle.id, label: formatPlate(entry.motorcycle.plate) } : null);
  const [method, setMethod] = useState<PaymentMethod | ''>(entry?.method ?? '');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);

  const catalog = useCatalog(type === 'INCOME' ? CatalogGroup.INCOME_CATEGORY : CatalogGroup.EXPENSE_CATEGORY);
  const options = (catalog.data ?? []).map((c) => ({ value: c.code, label: c.label }));
  // Categoria desativada depois do lançamento continua aparecendo nele.
  if (entry && entry.type === type && !options.some((o) => o.value === entry.categoryCode)) {
    options.unshift({ value: entry.categoryCode, label: entry.categoryLabel });
  }

  const busy = create.isPending || update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const found: Record<string, string> = {};
    if (!amount || Number(amount) <= 0) found.amount = 'Informe o valor.';
    if (!date) found.date = 'Informe a data.';
    if (!category) found.category = 'Escolha a categoria.';
    if (!description.trim()) found.description = 'Descreva o lançamento.';
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = {
      type,
      categoryCode: category,
      amount,
      date,
      description: description.trim(),
      motorcycleId: moto?.id ?? null,
      method: method || null,
    };
    try {
      if (entry) {
        // Só o que mudou: o histórico mostra exatamente o que foi alterado.
        const before: Record<string, unknown> = {
          type: entry.type,
          categoryCode: entry.categoryCode,
          amount: Number(entry.amount).toFixed(2),
          date: entry.date,
          description: entry.description,
          motorcycleId: entry.motorcycle?.id ?? null,
          method: entry.method,
        };
        const changed = Object.fromEntries(
          Object.entries(body).filter(([k, v]) => (k === 'amount' ? Number(v).toFixed(2) : v) !== before[k]),
        ) as Partial<typeof body>;
        if (Object.keys(changed).length) {
          await update.mutateAsync({ id: entry.id, ...changed });
          toast.success('Lançamento atualizado');
        }
      } else {
        await create.mutateAsync(body);
        toast.success(type === 'INCOME' ? 'Receita lançada' : 'Despesa lançada', { description: `${formatBRL(amount)} · ${description.trim()}` });
      }
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onArchive() {
    if (!entry) return;
    const ok = await confirm({
      title: 'Arquivar lançamento?',
      description: `"${entry.description}" sai do financeiro e dos relatórios. O histórico continua guardado.`,
      confirmText: 'Arquivar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await archive.mutateAsync(entry.id);
      toast.success('Lançamento arquivado');
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const clear = (k: string) => errors[k] && setErrors((p) => ({ ...p, [k]: undefined }));

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <DialogHeader>
        <DialogTitle>{entry ? 'Editar lançamento' : 'Novo lançamento'}</DialogTitle>
        <DialogDescription>Despesas e receitas que não são aluguel (os pagamentos dos clientes e as manutenções entram sozinhos).</DialogDescription>
      </DialogHeader>

      <div role="radiogroup" aria-label="Tipo de lançamento" className="grid grid-cols-2 gap-2">
        {(['EXPENSE', 'INCOME'] as const).map((t) => {
          const active = type === t;
          const Icon = t === 'INCOME' ? ArrowDownLeft : ArrowUpRight;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                if (t === type) return;
                setType(t);
                setCategory('');
              }}
              className={cn(
                'flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors',
                active ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'border-border bg-card hover:bg-accent',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t === 'INCOME' ? 'Receita (entrada)' : 'Despesa (saída)'}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor" required error={errors.amount}>
          {(id) => (
            <MoneyInput
              id={id}
              value={amount}
              onValue={(v) => {
                setAmount(v);
                clear('amount');
              }}
              placeholder="0,00"
            />
          )}
        </Field>
        <Field label="Data" required error={errors.date}>
          {(id) => (
            <Input
              id={id}
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                clear('date');
              }}
            />
          )}
        </Field>
      </div>
      <Field label="Categoria" required error={errors.category} hint="As categorias ficam em Configurações.">
        {(id) => (
          <SelectMenu
            id={id}
            value={category}
            onChange={(v) => {
              setCategory(v);
              clear('category');
            }}
            placeholder={catalog.isLoading ? 'Carregando…' : 'Escolha'}
            options={options}
          />
        )}
      </Field>
      <Field label="Descrição" required error={errors.description}>
        {(id) => (
          <Input
            id={id}
            value={description}
            maxLength={200}
            onChange={(e) => {
              setDescription(e.target.value);
              clear('description');
            }}
            placeholder={type === 'EXPENSE' ? 'Ex.: IPVA da moto, conta de luz' : 'Ex.: venda da moto, indenização'}
          />
        )}
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Moto (opcional)"
          hint={
            moto ? (
              <button type="button" className="text-primary hover:underline" onClick={() => setMoto(null)}>
                Remover moto
              </button>
            ) : (
              'Entra no resultado da moto.'
            )
          }
        >
          {(id) => <MotorcycleLookup id={id} value={moto?.id ?? null} valueLabel={moto?.label} onChange={(v, label) => setMoto(v ? { id: v, label: label ?? '' } : null)} />}
        </Field>
        <Field label="Forma de pagamento">
          {(id) => (
            <SelectMenu
              id={id}
              value={method}
              onChange={(v) => setMethod(v as PaymentMethod | '')}
              placeholder="Não informar"
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
            />
          )}
        </Field>
      </div>

      <FormError message={error} />
      <DialogFooter>
        {entry && (
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive sm:mr-auto" onClick={() => void onArchive()} disabled={archive.isPending}>
            <Archive /> Arquivar
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {entry ? 'Salvar' : 'Lançar'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Novo lançamento / edição (com arquivar). `entry = null` e `open` = novo. */
export function EntryDialog({ open, entry, onOpenChange }: { open: boolean; entry: FinancialEntryDto | null; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <EntryForm key={entry?.id ?? 'new'} entry={entry} onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}
