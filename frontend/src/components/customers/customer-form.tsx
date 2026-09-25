'use client';

import {
  CNH_CATEGORIES,
  isValidCep,
  isValidCpf,
  isValidPhone,
  type CreateCustomerRequest,
  type CustomerDto,
} from '@locamania/shared';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field, FormGrid, SectionCard, StickyActions } from '@/components/ui/kit';
import { MaskedInput } from '@/components/ui/masked-input';
import { SelectMenu } from '@/components/ui/select-menu';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, errorMessage } from '@/lib/api/client';
import { lookupCep } from '@/lib/api/cep';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

type Values = {
  [K in keyof CreateCustomerRequest]-?: string;
};

function initial(c?: CustomerDto | null): Values {
  return {
    name: c?.name ?? '',
    cpf: c?.cpf ?? '',
    rg: c?.rg ?? '',
    birthDate: c?.birthDate ?? '',
    phone: c?.phone ?? '',
    whatsapp: c?.whatsapp ?? '',
    email: c?.email ?? '',
    postalCode: c?.postalCode ?? '',
    street: c?.street ?? '',
    streetNumber: c?.streetNumber ?? '',
    complement: c?.complement ?? '',
    district: c?.district ?? '',
    city: c?.city ?? '',
    state: c?.state ?? '',
    cnhNumber: c?.cnhNumber ?? '',
    cnhCategory: c?.cnhCategory ?? '',
    cnhExpiresAt: c?.cnhExpiresAt ?? '',
    notes: c?.notes ?? '',
  };
}

function validate(v: Values): Partial<Record<keyof Values, string>> {
  const e: Partial<Record<keyof Values, string>> = {};
  if (v.name.trim().length < 3) e.name = 'Informe o nome completo.';
  if (!isValidCpf(v.cpf)) e.cpf = 'CPF inválido.';
  if (v.phone && !isValidPhone(v.phone)) e.phone = 'Telefone inválido.';
  if (v.whatsapp && !isValidPhone(v.whatsapp)) e.whatsapp = 'WhatsApp inválido.';
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'E-mail inválido.';
  if (v.postalCode && !isValidCep(v.postalCode)) e.postalCode = 'CEP inválido.';
  return e;
}

/** Cadastro e edição do cliente (§4). Máscaras enquanto digita; CEP preenche o endereço. */
export function CustomerForm({
  customer,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  customer?: CustomerDto | null;
  onSubmit: (body: CreateCustomerRequest) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [v, setV] = useState<Values>(() => initial(customer));
  const [sameWhats, setSameWhats] = useState(() => !customer || !customer.whatsapp || customer.whatsapp === customer.phone);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);

  const set = (k: keyof Values) => (value: string) => {
    setV((p) => ({ ...p, [k]: value }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  async function onCep(value: string) {
    set('postalCode')(value);
    if (value.length !== 8) return;
    setCepBusy(true);
    const addr = await lookupCep(value);
    setCepBusy(false);
    if (addr) setV((p) => ({ ...p, street: addr.street || p.street, district: addr.district || p.district, city: addr.city || p.city, state: addr.state || p.state }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found = validate(v);
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError('Confira os campos marcados.');
      return;
    }
    const n = (s: string) => (s.trim() ? s.trim() : null);
    setBusy(true);
    try {
      await onSubmit({
        name: v.name.trim(),
        cpf: v.cpf,
        rg: n(v.rg),
        birthDate: n(v.birthDate),
        phone: n(v.phone),
        whatsapp: sameWhats ? n(v.phone) : n(v.whatsapp),
        email: n(v.email)?.toLowerCase() ?? null,
        postalCode: n(v.postalCode),
        street: n(v.street),
        streetNumber: n(v.streetNumber),
        complement: n(v.complement),
        district: n(v.district),
        city: n(v.city),
        state: n(v.state),
        cnhNumber: n(v.cnhNumber),
        cnhCategory: (n(v.cnhCategory) as CreateCustomerRequest['cnhCategory']) ?? null,
        cnhExpiresAt: n(v.cnhExpiresAt),
        notes: n(v.notes),
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT') setErrors((p) => ({ ...p, cpf: err.message }));
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <SectionCard title="Dados pessoais">
        <FormGrid cols={4}>
          <Field label="Nome completo" required error={errors.name} className="sm:col-span-2">
            {(id) => <Input id={id} value={v.name} onChange={(e) => set('name')(e.target.value)} autoComplete="name" autoCapitalize="words" maxLength={120} />}
          </Field>
          <Field label="CPF" required error={errors.cpf}>
            {(id) => <MaskedInput id={id} mask="cpf" value={v.cpf} onValue={set('cpf')} placeholder="000.000.000-00" />}
          </Field>
          <Field label="RG">{(id) => <Input id={id} value={v.rg} onChange={(e) => set('rg')(e.target.value)} maxLength={20} />}</Field>
          <Field label="Data de nascimento">{(id) => <Input id={id} type="date" value={v.birthDate} onChange={(e) => set('birthDate')(e.target.value)} />}</Field>
        </FormGrid>
      </SectionCard>

      <SectionCard title="Contato">
        <FormGrid cols={3}>
          <Field label="Celular" error={errors.phone}>
            {(id) => <MaskedInput id={id} mask="phone" value={v.phone} onValue={set('phone')} placeholder="(00) 00000-0000" autoComplete="tel" />}
          </Field>
          <Field label="WhatsApp" error={errors.whatsapp} hint={sameWhats ? 'Mesmo número do celular.' : undefined}>
            {(id) => (
              <div className="space-y-2">
                {!sameWhats && <MaskedInput id={id} mask="phone" value={v.whatsapp} onValue={set('whatsapp')} placeholder="(00) 00000-0000" />}
                <div className="flex min-h-10 items-center gap-2">
                  <Checkbox checked={sameWhats} onCheckedChange={setSameWhats} id={`${id}-same`} />
                  <label htmlFor={`${id}-same`} className="text-sm">
                    WhatsApp é o mesmo celular
                  </label>
                </div>
              </div>
            )}
          </Field>
          <Field label="E-mail" error={errors.email}>
            {(id) => <Input id={id} type="email" inputMode="email" value={v.email} onChange={(e) => set('email')(e.target.value)} autoComplete="email" autoCapitalize="none" />}
          </Field>
        </FormGrid>
      </SectionCard>

      <SectionCard title="Endereço">
        <FormGrid cols={4}>
          <Field label="CEP" error={errors.postalCode} hint={cepBusy ? 'Buscando endereço...' : 'Preenche rua, bairro e cidade.'}>
            {(id) => (
              <div className="relative">
                <MaskedInput id={id} mask="cep" value={v.postalCode} onValue={onCep} placeholder="00000-000" autoComplete="postal-code" />
                {cepBusy && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
              </div>
            )}
          </Field>
          <Field label="Rua" className="sm:col-span-2 lg:col-span-2">
            {(id) => <Input id={id} value={v.street} onChange={(e) => set('street')(e.target.value)} autoComplete="address-line1" />}
          </Field>
          <Field label="Número">{(id) => <Input id={id} value={v.streetNumber} onChange={(e) => set('streetNumber')(e.target.value)} inputMode="text" maxLength={10} />}</Field>
          <Field label="Complemento">{(id) => <Input id={id} value={v.complement} onChange={(e) => set('complement')(e.target.value)} />}</Field>
          <Field label="Bairro">{(id) => <Input id={id} value={v.district} onChange={(e) => set('district')(e.target.value)} />}</Field>
          <Field label="Cidade">{(id) => <Input id={id} value={v.city} onChange={(e) => set('city')(e.target.value)} autoComplete="address-level2" />}</Field>
          <Field label="UF">
            {(id) => <SelectMenu id={id} value={v.state} onChange={set('state')} placeholder="UF" options={UFS.map((u) => ({ value: u, label: u }))} />}
          </Field>
        </FormGrid>
      </SectionCard>

      <SectionCard title="CNH" description="O sistema avisa antes do vencimento.">
        <FormGrid cols={3}>
          <Field label="Número da CNH">{(id) => <MaskedInput id={id} mask="digits" value={v.cnhNumber} onValue={set('cnhNumber')} maxLength={11} />}</Field>
          <Field label="Categoria">
            {(id) => <SelectMenu id={id} value={v.cnhCategory} onChange={set('cnhCategory')} placeholder="Escolha" options={CNH_CATEGORIES.map((c) => ({ value: c, label: c }))} />}
          </Field>
          <Field label="Validade">{(id) => <Input id={id} type="date" value={v.cnhExpiresAt} onChange={(e) => set('cnhExpiresAt')(e.target.value)} />}</Field>
        </FormGrid>
      </SectionCard>

      <SectionCard title="Observações">
        <Textarea rows={3} value={v.notes} onChange={(e) => set('notes')(e.target.value)} aria-label="Observações" placeholder="Anotações internas (o cliente não vê)." />
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
