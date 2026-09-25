'use client';

import { Permission, formatPlate } from '@locamania/shared';
import { ClipboardCheck, TriangleAlert } from 'lucide-react';
import { useParams } from 'next/navigation';

import { ReturnForm } from '@/components/contracts/return-form';
import { BackLink } from '@/components/ui/back-link';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/client';
import { useCan } from '@/lib/auth/use-auth';
import { useContract } from '@/lib/queries';

export default function ContractReturnPage() {
  const { id } = useParams<{ id: string }>();
  const { data: c, isLoading, error } = useContract(id);
  const canManage = useCan(Permission.CONTRACTS_MANAGE);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (error || !c) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Contrato não encontrado"
        description={errorMessage(error)}
        action={<BackLink href="/admin/contracts">Voltar para contratos</BackLink>}
      />
    );
  }
  const back = <BackLink href={`/admin/contracts/${c.id}`}>{c.number}</BackLink>;
  if (!canManage || c.status !== 'ACTIVE') {
    return (
      <div className="space-y-5">
        {back}
        <EmptyState
          icon={ClipboardCheck}
          title={
            !canManage
              ? 'Sem permissão para registrar devolução'
              : c.status === 'ENDED'
                ? 'A devolução já foi registrada'
                : 'Este contrato não está ativo'
          }
          description={
            !canManage
              ? 'Peça a quem administra o sistema para liberar “Criar e alterar contratos”.'
              : 'Só contratos ativos (moto entregue) têm devolução.'
          }
          action={back}
        />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {back}
      <PageHeader
        title="Devolução da moto"
        description={`${formatPlate(c.motorcycle.plate)} · ${c.motorcycle.label} — ${c.customer.label}`}
      />
      <ReturnForm contract={c} />
    </div>
  );
}
