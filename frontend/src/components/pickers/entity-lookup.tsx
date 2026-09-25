'use client';

import { formatCpf, formatPlate, type MotorcycleStatus } from '@locamania/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Lookup } from '@/components/ui/lookup';
import { customersApi, motorcyclesApi } from '@/lib/api/resources';

/** Busca de cliente por nome, CPF ou telefone (só aceita item selecionado). */
export function CustomerLookup({
  value,
  valueLabel,
  onChange,
  id,
  disabled,
  placeholder = 'Buscar cliente por nome ou CPF...',
}: {
  value: string | null;
  valueLabel?: string | null;
  onChange: (id: string | null, label?: string) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [term, setTerm] = useState('');
  const { data, isFetching } = useQuery({
    queryKey: ['customers', 'lookup', term],
    queryFn: () => customersApi.list({ search: term || undefined, pageSize: 20 }),
    staleTime: 30_000,
  });
  return (
    <Lookup
      id={id}
      value={value}
      valueLabel={valueLabel}
      disabled={disabled}
      placeholder={placeholder}
      loading={isFetching}
      onSearchChange={setTerm}
      options={(data?.data ?? []).map((c) => ({
        value: c.id,
        label: c.name,
        hint: `${formatCpf(c.cpf)}${c.currentMotorcycle ? ` · ${formatPlate(c.currentMotorcycle.plate)}` : ''}`,
      }))}
      onChange={(v, opt) => onChange(v, opt?.label)}
      emptyLabel="Nenhum cliente encontrado"
    />
  );
}

/** Busca de moto por placa ou modelo; `status` filtra (ex.: só disponíveis). */
export function MotorcycleLookup({
  value,
  valueLabel,
  onChange,
  status,
  id,
  disabled,
  placeholder = 'Buscar moto por placa ou modelo...',
}: {
  value: string | null;
  valueLabel?: string | null;
  onChange: (id: string | null, label?: string) => void;
  status?: MotorcycleStatus;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [term, setTerm] = useState('');
  const { data, isFetching } = useQuery({
    queryKey: ['motorcycles', 'lookup', term, status],
    queryFn: () => motorcyclesApi.list({ search: term || undefined, status, pageSize: 30 }),
    staleTime: 30_000,
  });
  return (
    <Lookup
      id={id}
      value={value}
      valueLabel={valueLabel}
      disabled={disabled}
      placeholder={placeholder}
      loading={isFetching}
      onSearchChange={setTerm}
      options={(data?.data ?? []).map((m) => ({
        value: m.id,
        label: `${formatPlate(m.plate)} · ${m.label}`,
        hint: [m.modelYear, m.color].filter(Boolean).join(' · ') || undefined,
      }))}
      onChange={(v, opt) => onChange(v, opt?.label)}
      emptyLabel="Nenhuma moto encontrada"
    />
  );
}
