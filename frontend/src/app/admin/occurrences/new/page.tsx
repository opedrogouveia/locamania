'use client';

import { OCCURRENCE_TYPES, formatPlate, type OccurrenceType } from '@locamania/shared';
import { useRouter } from 'next/navigation';

import { OccurrenceForm } from '@/components/occurrences/occurrence-form';
import { BackLink } from '@/components/ui/back-link';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { useCreateOccurrence, useCustomer, useMotorcycle } from '@/lib/queries';
import { useUrlState } from '@/lib/use-url-state';

/** Nova ocorrência. Aceita `?motorcycleId=`, `?customerId=` e `?type=` (vindo da ficha da moto/cliente). */
export default function NewOccurrencePage() {
  const router = useRouter();
  const create = useCreateOccurrence();
  const [q, , ready] = useUrlState({ motorcycleId: '', customerId: '', type: '' });
  const moto = useMotorcycle(ready && q.motorcycleId ? q.motorcycleId : undefined);
  const customer = useCustomer(ready && q.customerId ? q.customerId : undefined);
  const loading = !ready || (!!q.motorcycleId && moto.isLoading) || (!!q.customerId && customer.isLoading);
  const back = q.customerId ? `/admin/customers/${q.customerId}?tab=occurrences` : q.motorcycleId ? `/admin/motorcycles/${q.motorcycleId}` : '/admin/occurrences';

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackLink href={back}>{q.customerId && customer.data ? customer.data.name : q.motorcycleId && moto.data ? formatPlate(moto.data.plate) : 'Ocorrências e multas'}</BackLink>
      <PageHeader title="Nova ocorrência" description="Multa, acidente, avaria, furto/roubo ou problema mecânico." />
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <OccurrenceForm
          initial={{
            type: (OCCURRENCE_TYPES as string[]).includes(q.type) ? (q.type as OccurrenceType) : undefined,
            motorcycle: moto.data ? { id: moto.data.id, label: `${formatPlate(moto.data.plate)} · ${moto.data.label}` } : null,
            customer: customer.data ? { id: customer.data.id, label: customer.data.name } : null,
          }}
          submitLabel="Registrar ocorrência"
          onCancel={() => router.push(back)}
          onSubmit={async (body) => {
            const o = await create.mutateAsync(body);
            toast.success('Ocorrência registrada', { description: o.customer ? `Ligada a ${o.customer.label}` : undefined });
            router.replace(`/admin/occurrences/${o.id}`);
          }}
        />
      )}
    </div>
  );
}
