'use client';

import type { MaintenanceTypeDto } from '@locamania/shared';
import { Plus, Wrench } from 'lucide-react';
import { useState } from 'react';

import { MaintenanceTypeDialog } from '@/components/settings/maintenance-type-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { MobileRow } from '@/components/ui/kit';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCreateMaintenanceType, useMaintenanceTypes, useUpdateMaintenanceType } from '@/lib/queries';
import { formatKm } from '@/lib/utils';

/** 120 → "120 dias (4 meses)"; 540 → "540 dias (18 meses)". */
function daysText(d: number): string {
  if (d >= 60 && d % 30 === 0) return `${d} dias (${d / 30} meses)`;
  return `${d} ${d === 1 ? 'dia' : 'dias'}`;
}

function intervalText(t: MaintenanceTypeDto): string {
  const parts = [t.defaultIntervalKm ? formatKm(t.defaultIntervalKm) : null, t.defaultIntervalDays ? daysText(t.defaultIntervalDays) : null].filter(Boolean);
  return parts.length ? `A cada ${parts.join(' ou ')}` : 'Sem intervalo (só registro avulso)';
}

export default function MaintenanceTypesPage() {
  const { data, isLoading, error } = useMaintenanceTypes(true);
  const create = useCreateMaintenanceType();
  const update = useUpdateMaintenanceType();
  const [dialog, setDialog] = useState<{ open: boolean; type: MaintenanceTypeDto | null }>({ open: false, type: null });

  const rows = data ? [...data].sort((a, b) => Number(b.active) - Number(a.active) || a.sortOrder - b.sortOrder) : undefined;

  const columns: Column<MaintenanceTypeDto>[] = [
    { key: 'name', header: 'Tipo', cell: (t) => <span className="font-medium">{t.name}</span> },
    {
      key: 'km',
      header: 'A cada (km)',
      align: 'right',
      cell: (t) => (t.defaultIntervalKm ? formatKm(t.defaultIntervalKm) : <span className="text-muted-foreground">—</span>),
    },
    {
      key: 'days',
      header: 'A cada (tempo)',
      align: 'right',
      cell: (t) => (t.defaultIntervalDays ? daysText(t.defaultIntervalDays) : <span className="text-muted-foreground">—</span>),
    },
    {
      key: 'active',
      header: 'Situação',
      align: 'right',
      cell: (t) => (t.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="muted">Desativado</Badge>),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tipos de manutenção"
        description="Toda moto nova já nasce com um plano para cada tipo com intervalo. Mudar aqui não altera as motos já cadastradas."
        actions={
          <Button className="w-full sm:w-auto" onClick={() => setDialog({ open: true, type: null })}>
            <Plus /> Novo tipo
          </Button>
        }
      />
      <Card>
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : (
          <DataTable
            rows={rows}
            loading={isLoading}
            columns={columns}
            rowKey={(t) => t.id}
            onRowClick={(t) => setDialog({ open: true, type: t })}
            rowClassName={(t) => (t.active ? undefined : 'opacity-60')}
            empty={{ icon: Wrench, title: 'Nenhum tipo cadastrado', description: 'Cadastre troca de óleo, revisão, pneus…' }}
            mobileCard={(t) => (
              <MobileRow
                title={t.name}
                subtitle={intervalText(t)}
                right={t.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="muted">Desativado</Badge>}
              />
            )}
          />
        )}
      </Card>

      <MaintenanceTypeDialog
        open={dialog.open}
        type={dialog.type}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSubmit={async (body) => {
          if (dialog.type) {
            await update.mutateAsync({ id: dialog.type.id, ...body });
            toast.success('Tipo de manutenção salvo', { description: body.name });
          } else {
            await create.mutateAsync(body);
            toast.success('Tipo de manutenção cadastrado', { description: body.name });
          }
        }}
      />
    </div>
  );
}
