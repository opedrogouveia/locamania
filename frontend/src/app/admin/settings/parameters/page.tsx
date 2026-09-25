'use client';

import { PARAMETER_GROUP_LABELS, Permission, type ParameterDto, type ParameterGroup } from '@locamania/shared';
import { TriangleAlert } from 'lucide-react';

import { ParameterField } from '@/components/settings/parameter-field';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChips, SectionCard } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useParameters } from '@/lib/queries';
import { PARAMETER_GROUP_SHORT } from '@/lib/settings/meta';
import { useUrlState } from '@/lib/use-url-state';

const GROUP_ORDER: ParameterGroup[] = ['PAYMENTS', 'DELINQUENCY', 'MAINTENANCE', 'DOCUMENTS', 'CONTRACTS', 'NOTIFICATIONS'];

const GROUP_HINT: Record<ParameterGroup, string> = {
  PAYMENTS: 'Quando a cobrança fica próxima ou atrasada, quanto custa atrasar e quando o cliente é lembrado.',
  DELINQUENCY: 'O que acontece com o cliente que atrasa.',
  MAINTENANCE: 'Com quanta antecedência a manutenção aparece como próxima.',
  DOCUMENTS: 'Vencimento dos documentos e o que todo cliente precisa entregar.',
  CONTRACTS: 'Aviso de fim de contrato e de moto parada.',
  NOTIFICATIONS: 'Por onde os avisos automáticos saem, além do aplicativo.',
};

export default function ParametersPage() {
  const canEdit = useCan(Permission.SETTINGS_MANAGE);
  const [q, setQ] = useUrlState({ group: 'all' });
  const { data, isLoading, error } = useParameters();

  const byGroup = new Map<ParameterGroup, ParameterDto[]>();
  for (const p of data ?? []) byGroup.set(p.group, [...(byGroup.get(p.group) ?? []), p]);
  const groups = GROUP_ORDER.filter((g) => byGroup.has(g) && (q.group === 'all' || q.group === g));
  const changed = (data ?? []).filter((p) => p.value !== p.defaultValue).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Regras e avisos"
        description={
          data
            ? changed
              ? `Cada regra salva sozinha e vale na hora. ${changed} ${changed === 1 ? 'regra está diferente' : 'regras estão diferentes'} do padrão.`
              : 'Cada regra salva sozinha e vale na hora. Todas estão no padrão.'
            : 'Cada regra salva sozinha e vale na hora.'
        }
      />
      <FilterChips
        value={q.group ?? 'all'}
        onChange={(group) => setQ({ group })}
        options={[{ value: 'all', label: 'Todas' }, ...GROUP_ORDER.map((g) => ({ value: g, label: PARAMETER_GROUP_SHORT[g] ?? PARAMETER_GROUP_LABELS[g] }))]}
      />
      {isLoading ? (
        <div className="space-y-5">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error ? (
        <EmptyState icon={TriangleAlert} title="Não foi possível carregar as regras" description={errorMessage(error)} />
      ) : groups.length === 0 ? (
        <EmptyState title="Nenhuma regra neste grupo" />
      ) : (
        groups.map((g) => (
          <SectionCard key={g} title={PARAMETER_GROUP_LABELS[g]} description={GROUP_HINT[g]}>
            <div className="divide-y divide-border border-t border-border pt-4">
              {byGroup.get(g)!.map((p) => (
                <ParameterField key={p.key} parameter={p} canEdit={canEdit} />
              ))}
            </div>
          </SectionCard>
        ))
      )}
    </div>
  );
}
