'use client';

import { X } from 'lucide-react';

import { CustomerLookup } from '@/components/pickers/entity-lookup';

export interface PickedCustomer {
  id: string;
  label: string;
}

/** Vários clientes: busca (só seleciona) + lista de escolhidos com "remover". */
export function CustomerMultiPicker({ value, onChange, id }: { value: PickedCustomer[]; onChange: (v: PickedCustomer[]) => void; id?: string }) {
  return (
    <div className="space-y-3">
      <CustomerLookup
        id={id}
        value={null}
        placeholder="Buscar cliente por nome, CPF ou placa..."
        onChange={(cid, label) => {
          if (!cid || value.some((c) => c.id === cid)) return;
          onChange([...value, { id: cid, label: label ?? 'Cliente' }]);
        }}
      />
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Clientes escolhidos">
          {value.map((c) => (
            <li key={c.id} className="inline-flex h-9 max-w-full items-center gap-1 rounded-full border border-border bg-card pl-3 pr-1 text-sm">
              <span className="truncate">{c.label}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.id !== c.id))}
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={`Remover ${c.label}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
