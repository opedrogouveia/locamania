'use client';

import { useRouter } from 'next/navigation';

import { CustomerForm } from '@/components/customers/customer-form';
import { BackLink } from '@/components/ui/back-link';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from '@/components/ui/toaster';
import { useCreateCustomer } from '@/lib/queries';

export default function NewCustomerPage() {
  const router = useRouter();
  const create = useCreateCustomer();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackLink href="/admin/customers">Clientes</BackLink>
      <PageHeader title="Novo cliente" description="Só nome e CPF são obrigatórios; o resto pode ser completado depois." />
      <CustomerForm
        submitLabel="Cadastrar cliente"
        onCancel={() => router.push('/admin/customers')}
        onSubmit={async (body) => {
          const c = await create.mutateAsync(body);
          toast.success('Cliente cadastrado', { description: c.name });
          router.replace(`/admin/customers/${c.id}`);
        }}
      />
    </div>
  );
}
