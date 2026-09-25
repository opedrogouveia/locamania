'use client';

import { useParams, useRouter } from 'next/navigation';

import { CustomerForm } from '@/components/customers/customer-form';
import { BackLink } from '@/components/ui/back-link';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { errorMessage } from '@/lib/api/client';
import { useCustomer, useUpdateCustomer } from '@/lib/queries';

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useCustomer(id);
  const update = useUpdateCustomer(id);
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackLink href={`/admin/customers/${id}`}>{data?.name ?? 'Cliente'}</BackLink>
      <PageHeader title="Editar cliente" />
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : error || !data ? (
        <p className="text-sm text-destructive">{errorMessage(error)}</p>
      ) : (
        <CustomerForm
          customer={data}
          submitLabel="Salvar alterações"
          onCancel={() => router.push(`/admin/customers/${id}`)}
          onSubmit={async (body) => {
            await update.mutateAsync(body);
            toast.success('Cliente atualizado');
            router.push(`/admin/customers/${id}`);
          }}
        />
      )}
    </div>
  );
}
