'use client';

import type { CreateMotorcycleRequest } from '@locamania/shared';
import { useRouter } from 'next/navigation';

import { MotorcycleForm } from '@/components/motorcycles/motorcycle-form';
import { BackLink } from '@/components/ui/back-link';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from '@/components/ui/toaster';
import { useCreateMotorcycle } from '@/lib/queries';
import { formatPlate } from '@/lib/utils';

export default function NewMotorcyclePage() {
  const router = useRouter();
  const create = useCreateMotorcycle();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackLink href="/admin/motorcycles">Motos</BackLink>
      <PageHeader
        title="Nova moto"
        description="Placa, marca, modelo e quilometragem são obrigatórios. Os planos de manutenção são criados sozinhos."
      />
      <MotorcycleForm
        submitLabel="Cadastrar moto"
        onCancel={() => router.push('/admin/motorcycles')}
        onSubmit={async (body) => {
          const m = await create.mutateAsync(body as CreateMotorcycleRequest);
          toast.success('Moto cadastrada', {
            description: `${formatPlate(m.plate)} · planos de manutenção padrão já criados.`,
          });
          router.replace(`/admin/motorcycles/${m.id}?created=1`);
        }}
      />
    </div>
  );
}
