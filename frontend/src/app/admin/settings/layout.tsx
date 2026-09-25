import type { ReactNode } from 'react';

import { SettingsShell } from '@/components/settings/settings-shell';

export const metadata = { title: 'Configurações' };

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>;
}
