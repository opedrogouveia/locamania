'use client';

import { TriangleAlert } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { MotorcycleForm } from '@/components/motorcycles/motorcycle-form';
import { BackLink } from '@/components/ui/back-link';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useMotorcycle, useUpdateMotorcycle } from '@/lib/queries';
import { formatPlate } from '@/lib/utils';

export default function EditMotorcyclePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useMotorcycle(id);
  const update = useUpdateMotorcycle(id);
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackLink href={`/admin/motorcycles/${id}`}>
        {data ? `${formatPlate(data.plate)} · ${data.label}` : 'Moto'}
      </BackLink>
      <PageHeader title="Editar moto" />
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : error || !data ? (
        <EmptyState
          icon={TriangleAlert}
          title="Moto não encontrada"
          description={errorMessage(error)}
        />
      ) : (
        <MotorcycleForm
          motorcycle={data}
          submitLabel="Salvar alterações"
          onCancel={() => router.push(`/admin/motorcycles/${id}`)}
          onSubmit={async (body) => {
            await update.mutateAsync(body);
            toast.success('Moto atualizada');
            router.push(`/admin/motorcycles/${id}`);
          }}
        />
      )}
    </div>
  );
}
