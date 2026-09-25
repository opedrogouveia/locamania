import type { ReactNode } from 'react';

import { AdminShell } from '@/components/layout/admin-shell';

export const metadata = { title: { default: 'Painel', template: '%s · Locamania' } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
