'use client';

import {
  BRAZILIAN_STATES,
  formatCnpj,
  isValidCep,
  isValidCnpj,
  isValidPhone,
  onlyDigits,
  type CompanySettingsDto,
  type UpdateCompanySettingsRequest,
} from '@locamania/shared';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Input } from '@/components/ui/input';
import { Field, FormGrid, SectionCard, StickyActions } from '@/components/ui/kit';
import { MaskedInput } from '@/components/ui/masked-input';
import { SelectMenu } from '@/components/ui/select-menu';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/api/client';
import { lookupCep } from '@/lib/api/cep';

type Editable = Omit<CompanySettingsDto, 'updatedAt' | 'contractTemplate'>;
type Values = { [K in keyof Editable]-?: string };

const FIELDS: (keyof Values)[] = [
  'tradeName',
  'legalName',
  'cnpj',
  'phone',
  'whatsapp',
  'email',
  'postalCode',
  'street',
  'streetNumber',
  'complement',
  'district',
  'city',
  'state',
  'pixKey',
  'supportHours',
];

function initial(c: CompanySettingsDto): Values {
  return Object.fromEntries(FIELDS.map((k) => [k, (c[k] as string | null) ?? ''])) as Values;
}

function validate(v: Values): Partial<Record<keyof Values, string>> {
  const e: Partial<Record<keyof Values, string>> = {};
  if (!v.tradeName.trim()) e.tradeName = 'Informe o nome da empresa.';
  if (v.cnpj && !isValidCnpj(v.cnpj)) e.cnpj = 'CNPJ inválido. Confira os números.';
  if (v.phone && !isValidPhone(v.phone)) e.phone = 'Telefone inválido (com DDD).';
  if (v.whatsapp && !isValidPhone(v.whatsapp)) e.whatsapp = 'WhatsApp inválido (com DDD).';
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = 'E-mail inválido.';
  if (v.postalCode && !isValidCep(v.postalCode)) e.postalCode = 'CEP inválido.';
  return e;
}

/** Dados da empresa (§42): aparecem no contrato, no recibo e no Suporte do app. */
export function CompanyForm({ company, onSave }: { company: CompanySettingsDto; onSave: (body: UpdateCompanySettingsRequest) => Promise<void> }) {
  const [base, setBase] = useState<Values>(() => initial(company));
  const [v, setV] = useState<Values>(base);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);

  const dirty = FIELDS.some((k) => v[k] !== base[k]);

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
    const body: UpdateCompanySettingsRequest = {
      tradeName: v.tradeName.trim(),
      legalName: n(v.legalName),
      cnpj: n(v.cnpj),
      phone: n(v.phone),
      whatsapp: n(v.whatsapp),
      email: n(v.email)?.toLowerCase() ?? null,
      postalCode: n(v.postalCode),
      street: n(v.street),
      streetNumber: n(v.streetNumber),
      complement: n(v.complement),
      district: n(v.district),
      city: n(v.city),
      state: n(v.state),
      pixKey: n(v.pixKey),
      supportHours: n(v.supportHours),
    };
    setBusy(true);
    try {
      await onSave(body);
      setBase(v);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <SectionCard title="Identificação" description="Aparece no contrato, nos recibos e no aplicativo do cliente.">
        <FormGrid cols={2}>
          <Field label="Nome da empresa" required error={errors.tradeName} hint="O nome que os clientes conhecem.">
            {(id) => <Input id={id} value={v.tradeName} onChange={(e) => set('tradeName')(e.target.value)} maxLength={120} autoCapitalize="words" />}
          </Field>
          <Field label="Razão social" hint="Como está no cartão do CNPJ.">
            {(id) => <Input id={id} value={v.legalName} onChange={(e) => set('legalName')(e.target.value)} maxLength={200} autoCapitalize="words" />}
          </Field>
          <Field label="CNPJ" error={errors.cnpj}>
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="off"
                placeholder="00.000.000/0000-00"
                value={formatCnpj(v.cnpj)}
                onChange={(e) => set('cnpj')(onlyDigits(e.target.value).slice(0, 14))}
                className="tabular"
              />
            )}
          </Field>
          <Field label="Chave PIX" hint="CNPJ, e-mail, telefone ou chave aleatória. Aparece no recibo e para pagamento manual.">
            {(id) => <Input id={id} value={v.pixKey} onChange={(e) => set('pixKey')(e.target.value)} maxLength={120} autoCapitalize="none" autoComplete="off" />}
          </Field>
        </FormGrid>
      </SectionCard>

      <SectionCard title="Atendimento" description="O cliente vê estes contatos na tela de Suporte do aplicativo.">
        <FormGrid cols={3}>
          <Field label="Telefone" error={errors.phone}>
            {(id) => <MaskedInput id={id} mask="phone" value={v.phone} onValue={set('phone')} placeholder="(00) 0000-0000" autoComplete="tel" />}
          </Field>
          <Field label="WhatsApp" error={errors.whatsapp} hint="Número que recebe as mensagens dos clientes.">
            {(id) => <MaskedInput id={id} mask="phone" value={v.whatsapp} onValue={set('whatsapp')} placeholder="(00) 00000-0000" />}
          </Field>
          <Field label="E-mail" error={errors.email}>
            {(id) => (
              <Input id={id} type="email" inputMode="email" value={v.email} onChange={(e) => set('email')(e.target.value)} autoCapitalize="none" autoComplete="email" maxLength={120} />
            )}
          </Field>
          <Field label="Horário de atendimento" className="sm:col-span-2 lg:col-span-3" hint="Ex.: Segunda a sexta, das 8h às 18h. Sábado, das 8h às 12h.">
            {(id) => <Textarea id={id} rows={2} value={v.supportHours} onChange={(e) => set('supportHours')(e.target.value)} maxLength={300} />}
          </Field>
        </FormGrid>
      </SectionCard>

      <SectionCard title="Endereço" description="Usado no contrato (inclusive a cidade do foro).">
        <FormGrid cols={4}>
          <Field label="CEP" error={errors.postalCode} hint={cepBusy ? 'Buscando endereço...' : 'Preenche rua, bairro e cidade.'}>
            {(id) => (
              <div className="relative">
                <MaskedInput id={id} mask="cep" value={v.postalCode} onValue={onCep} placeholder="00000-000" autoComplete="postal-code" />
                {cepBusy && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
              </div>
            )}
          </Field>
          <Field label="Rua" className="sm:col-span-2">
            {(id) => <Input id={id} value={v.street} onChange={(e) => set('street')(e.target.value)} autoComplete="address-line1" maxLength={200} />}
          </Field>
          <Field label="Número">{(id) => <Input id={id} value={v.streetNumber} onChange={(e) => set('streetNumber')(e.target.value)} maxLength={20} />}</Field>
          <Field label="Complemento">{(id) => <Input id={id} value={v.complement} onChange={(e) => set('complement')(e.target.value)} maxLength={120} />}</Field>
          <Field label="Bairro">{(id) => <Input id={id} value={v.district} onChange={(e) => set('district')(e.target.value)} maxLength={120} />}</Field>
          <Field label="Cidade">{(id) => <Input id={id} value={v.city} onChange={(e) => set('city')(e.target.value)} autoComplete="address-level2" maxLength={120} />}</Field>
          <Field label="UF">
            {(id) => <SelectMenu id={id} value={v.state} onChange={set('state')} placeholder="UF" options={BRAZILIAN_STATES.map((u) => ({ value: u, label: u }))} />}
          </Field>
        </FormGrid>
      </SectionCard>

      <FormError message={formError} />
      <StickyActions>
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || busy}
          onClick={() => {
            setV(base);
            setErrors({});
            setFormError(null);
          }}
        >
          Desfazer
        </Button>
        <Button type="submit" disabled={!dirty || busy}>
          {busy && <Loader2 className="animate-spin" />}
          Salvar alterações
        </Button>
      </StickyActions>
    </form>
  );
}
