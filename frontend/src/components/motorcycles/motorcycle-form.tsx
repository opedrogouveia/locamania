'use client';

import {
  CatalogGroup,
  Permission,
  isValidPlate,
  type CreateMotorcycleRequest,
  type MotorcycleDto,
  type UpdateMotorcycleRequest,
} from '@locamania/shared';
import { Gauge, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field, FormGrid, SectionCard, StickyActions } from '@/components/ui/kit';
import { MaskedInput, MoneyInput, NumberInput } from '@/components/ui/masked-input';
import { SelectMenu } from '@/components/ui/select-menu';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { formatDateTime, formatKm } from '@/lib/utils';
import { CatalogLookup } from './catalog-lookup';

/** Cores do documento (padrão do DENATRAN) — lista, não texto livre. */
export const MOTORCYCLE_COLORS = [
  'Preta',
  'Branca',
  'Prata',
  'Cinza',
  'Vermelha',
  'Azul',
  'Verde',
  'Amarela',
  'Laranja',
  'Marrom',
  'Bege',
  'Dourada',
  'Grená',
  'Rosa',
  'Roxa',
  'Fantasia',
];

interface Values {
  plate: string;
  brandCode: string;
  modelCode: string;
  manufactureYear: number | null;
  modelYear: number | null;
  color: string;
  renavam: string;
  chassis: string;
  currentKm: number | null;
  acquiredAt: string;
  purchasePrice: string;
  hasTracker: boolean;
  trackerProvider: string;
  trackerDeviceId: string;
  notes: string;
}

type Errors = Partial<Record<keyof Values, string>>;

function initial(m?: MotorcycleDto | null): Values {
  return {
    plate: m?.plate ?? '',
    brandCode: m?.brandCode ?? '',
    modelCode: m?.modelCode ?? '',
    manufactureYear: m?.manufactureYear ?? null,
    modelYear: m?.modelYear ?? null,
    color: m?.color ?? '',
    renavam: m?.renavam ?? '',
    chassis: m?.chassis ?? '',
    currentKm: m ? m.currentKm : null,
    acquiredAt: m?.acquiredAt ?? '',
    purchasePrice: m?.purchasePrice ?? '',
    hasTracker: m?.hasTracker ?? false,
    trackerProvider: m?.trackerProvider ?? '',
    trackerDeviceId: m?.trackerDeviceId ?? '',
    notes: m?.notes ?? '',
  };
}

function validate(v: Values, creating: boolean): Errors {
  const e: Errors = {};
  const maxYear = new Date().getFullYear() + 1;
  if (!isValidPlate(v.plate)) e.plate = 'Placa inválida (ex.: ABC-1234 ou ABC1D23).';
  if (!v.brandCode) e.brandCode = 'Escolha a marca.';
  if (!v.modelCode) e.modelCode = 'Escolha o modelo.';
  if (v.manufactureYear !== null && (v.manufactureYear < 1990 || v.manufactureYear > maxYear))
    e.manufactureYear = 'Ano inválido.';
  if (v.modelYear !== null && (v.modelYear < 1990 || v.modelYear > maxYear))
    e.modelYear = 'Ano inválido.';
  if (
    !e.modelYear &&
    v.manufactureYear !== null &&
    v.modelYear !== null &&
    v.modelYear < v.manufactureYear
  )
    e.modelYear = 'Não pode ser anterior ao de fabricação.';
  if (v.renavam && v.renavam.length !== 11) e.renavam = 'O RENAVAM tem 11 dígitos.';
  if (v.chassis && !/^[A-HJ-NPR-Z0-9]{17}$/.test(v.chassis))
    e.chassis = 'O chassi tem 17 caracteres (letras e números, sem I, O e Q).';
  if (creating && v.currentKm === null) e.currentKm = 'Informe a quilometragem atual.';
  return e;
}

/**
 * Cadastro e edição da moto (§5). Marca e modelo vêm das listas (com
 * "Cadastrar X" ali mesmo); valor de compra só para quem vê o financeiro.
 */
export function MotorcycleForm({
  motorcycle,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  motorcycle?: MotorcycleDto | null;
  onSubmit: (body: CreateMotorcycleRequest | UpdateMotorcycleRequest) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const creating = !motorcycle;
  const canFinance = useCan(Permission.FINANCE_VIEW);
  const canCreateCatalog = useCan(Permission.MOTORCYCLES_MANAGE);
  const [v, setV] = useState<Values>(() => initial(motorcycle));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof Values>(k: K, value: Values[K]) {
    setV((p) => ({ ...p, [k]: value }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  }

  const colorOptions =
    MOTORCYCLE_COLORS.includes(v.color) || !v.color
      ? MOTORCYCLE_COLORS
      : [v.color, ...MOTORCYCLE_COLORS];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found = validate(v, creating);
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError('Confira os campos marcados.');
      return;
    }
    const n = (s: string) => (s.trim() ? s.trim() : null);
    const body: UpdateMotorcycleRequest = {
      plate: v.plate,
      brandCode: v.brandCode,
      modelCode: v.modelCode,
      manufactureYear: v.manufactureYear,
      modelYear: v.modelYear,
      color: n(v.color),
      renavam: n(v.renavam),
      chassis: n(v.chassis),
      acquiredAt: n(v.acquiredAt),
      hasTracker: v.hasTracker,
      trackerProvider: v.hasTracker ? n(v.trackerProvider) : null,
      trackerDeviceId: v.hasTracker ? n(v.trackerDeviceId) : null,
      notes: n(v.notes),
    };
    // Sem permissão o valor chega nulo: não mandar, para não apagar o que existe.
    if (canFinance) body.purchasePrice = v.purchasePrice || null;
    setBusy(true);
    try {
      await onSubmit(
        creating ? ({ ...body, currentKm: v.currentKm ?? 0 } as CreateMotorcycleRequest) : body,
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PLATE_TAKEN')
        setErrors((p) => ({ ...p, plate: err.message }));
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <SectionCard title="Identificação">
        <FormGrid cols={3}>
          <Field label="Placa" required error={errors.plate}>
            {(id) => (
              <MaskedInput
                id={id}
                mask="plate"
                value={v.plate}
                onValue={(x) => set('plate', x)}
                placeholder="ABC1D23"
                autoCapitalize="characters"
              />
            )}
          </Field>
          <Field label="Marca" required error={errors.brandCode}>
            {(id) => (
              <CatalogLookup
                id={id}
                group={CatalogGroup.MOTORCYCLE_BRAND}
                value={v.brandCode}
                onChange={(x) => set('brandCode', x)}
                placeholder="Escolha a marca"
                canCreate={canCreateCatalog}
              />
            )}
          </Field>
          <Field label="Modelo" required error={errors.modelCode}>
            {(id) => (
              <CatalogLookup
                id={id}
                group={CatalogGroup.MOTORCYCLE_MODEL}
                value={v.modelCode}
                onChange={(x) => set('modelCode', x)}
                placeholder="Escolha o modelo"
                canCreate={canCreateCatalog}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ano fabricação" error={errors.manufactureYear}>
              {(id) => (
                <NumberInput
                  id={id}
                  value={v.manufactureYear}
                  thousands={false}
                  maxLength={4}
                  placeholder="2025"
                  onValue={(x) => {
                    set('manufactureYear', x);
                    // O ano do modelo quase sempre é o mesmo: já sugere.
                    if (x !== null && x >= 1990 && v.modelYear === null)
                      setV((p) => ({ ...p, manufactureYear: x, modelYear: x }));
                  }}
                />
              )}
            </Field>
            <Field label="Ano do modelo" error={errors.modelYear}>
              {(id) => (
                <NumberInput
                  id={id}
                  value={v.modelYear}
                  thousands={false}
                  maxLength={4}
                  placeholder="2025"
                  onValue={(x) => set('modelYear', x)}
                />
              )}
            </Field>
          </div>
          <Field label="Cor">
            {(id) => (
              <SelectMenu
                id={id}
                value={v.color}
                onChange={(x) => set('color', x)}
                placeholder="Escolha a cor"
                options={colorOptions.map((c) => ({ value: c, label: c }))}
              />
            )}
          </Field>
        </FormGrid>
      </SectionCard>

      <SectionCard title="Documento da moto" description="Como está no CRLV.">
        <FormGrid cols={2}>
          <Field label="RENAVAM" error={errors.renavam} hint="11 dígitos.">
            {(id) => (
              <MaskedInput
                id={id}
                mask="digits"
                value={v.renavam}
                onValue={(x) => set('renavam', x.slice(0, 11))}
                maxLength={11}
                className="font-mono tracking-wide"
              />
            )}
          </Field>
          <Field label="Chassi" error={errors.chassis} hint={`${v.chassis.length}/17 caracteres.`}>
            {(id) => (
              <Input
                id={id}
                value={v.chassis}
                onChange={(e) =>
                  set(
                    'chassis',
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 17),
                  )
                }
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="font-mono uppercase tracking-wide"
              />
            )}
          </Field>
        </FormGrid>
      </SectionCard>

      <SectionCard title={canFinance ? 'Quilometragem e compra' : 'Quilometragem e aquisição'}>
        <FormGrid cols={3}>
          {creating ? (
            <Field
              label="Quilometragem atual"
              required
              error={errors.currentKm}
              hint="O que marca o painel hoje."
            >
              {(id) => (
                <NumberInput
                  id={id}
                  value={v.currentKm}
                  onValue={(x) => set('currentKm', x)}
                  suffix="km"
                  placeholder="0"
                />
              )}
            </Field>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[13px] font-medium">Quilometragem atual</p>
              <p className="flex h-10 items-center gap-2 rounded-md border border-dashed border-input px-3 text-sm tabular">
                <Gauge className="size-4 text-muted-foreground" aria-hidden />
                {formatKm(motorcycle.currentKm)}
              </p>
              <p className="text-xs text-muted-foreground">
                Muda pelo &ldquo;Registrar km&rdquo; da ficha
                {motorcycle.lastOdometerAt
                  ? ` · última leitura ${formatDateTime(motorcycle.lastOdometerAt)}`
                  : ''}
                .
              </p>
            </div>
          )}
          <Field label="Data de aquisição">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={v.acquiredAt}
                onChange={(e) => set('acquiredAt', e.target.value)}
              />
            )}
          </Field>
          {canFinance && (
            <Field label="Valor da moto" hint="Quanto foi pago na compra.">
              {(id) => (
                <MoneyInput
                  id={id}
                  value={v.purchasePrice}
                  onValue={(x) => set('purchasePrice', x)}
                  placeholder="0,00"
                />
              )}
            </Field>
          )}
        </FormGrid>
      </SectionCard>

      <SectionCard title="Rastreador">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <label htmlFor="moto-has-tracker" className="min-w-0">
              <span className="block text-sm font-medium">Tem rastreador instalado</span>
              <span className="block text-xs text-muted-foreground">
                Com a identificação do equipamento, a posição aparece em Rastreamento.
              </span>
            </label>
            <Switch
              id="moto-has-tracker"
              checked={v.hasTracker}
              onCheckedChange={(x) => set('hasTracker', x)}
            />
          </div>
          {v.hasTracker && (
            <FormGrid cols={2}>
              <Field label="Fornecedor do rastreador" hint="Empresa do equipamento.">
                {(id) => (
                  <Input
                    id={id}
                    value={v.trackerProvider}
                    onChange={(e) => set('trackerProvider', e.target.value)}
                    maxLength={60}
                    placeholder="Nome da empresa"
                  />
                )}
              </Field>
              <Field
                label="Identificação do equipamento"
                hint="Número de série ou IMEI do rastreador."
              >
                {(id) => (
                  <Input
                    id={id}
                    value={v.trackerDeviceId}
                    onChange={(e) => set('trackerDeviceId', e.target.value)}
                    maxLength={60}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono"
                  />
                )}
              </Field>
            </FormGrid>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Observações">
        <Textarea
          rows={3}
          value={v.notes}
          onChange={(e) => set('notes', e.target.value)}
          aria-label="Observações"
          placeholder="Acessórios, avarias antigas, detalhes da moto (o cliente não vê)."
          maxLength={4000}
        />
      </SectionCard>

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
