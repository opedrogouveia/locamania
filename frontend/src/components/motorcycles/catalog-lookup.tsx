'use client';

import { normalizeText, type CatalogGroup } from '@locamania/shared';
import { useMemo, useState } from 'react';

import { Lookup } from '@/components/ui/lookup';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCatalog, useCreateCatalog } from '@/lib/queries';

/**
 * Campo de lista mantida pela operação (marca, modelo...). Digitar filtra; se não
 * existir, o rodapé oferece "Cadastrar X" e o item novo já vem selecionado.
 */
export function CatalogLookup({
  group,
  value,
  onChange,
  id,
  placeholder,
  canCreate,
  disabled,
}: {
  group: CatalogGroup;
  value: string;
  onChange: (code: string) => void;
  id?: string;
  placeholder?: string;
  canCreate?: boolean;
  disabled?: boolean;
}) {
  const { data, isLoading } = useCatalog(group);
  const create = useCreateCatalog();
  const [term, setTerm] = useState('');
  const items = useMemo(() => data ?? [], [data]);
  const options = useMemo(() => {
    const t = normalizeText(term);
    return items
      .filter((i) => !t || normalizeText(i.label).includes(t))
      .map((i) => ({ value: i.code, label: i.label, isNew: i.userCreated }));
  }, [items, term]);
  const current = items.find((i) => i.code === value);

  return (
    <Lookup
      id={id}
      value={value || null}
      valueLabel={current?.label ?? value}
      onChange={(v) => onChange(v ?? '')}
      onSearchChange={setTerm}
      options={options}
      loading={isLoading}
      placeholder={placeholder}
      disabled={disabled}
      emptyLabel="Nada encontrado — digite o nome para cadastrar"
      createLabel={(t) => `Cadastrar "${t}"`}
      onCreate={
        canCreate
          ? async (label) => {
              try {
                const item = await create.mutateAsync({ group, label, fromForm: true });
                toast.success(`"${item.label}" cadastrado`);
                return { value: item.code, label: item.label };
              } catch (e) {
                toast.error(errorMessage(e));
                return null;
              }
            }
          : undefined
      }
    />
  );
}
