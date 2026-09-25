import { SetPasswordForm } from '@/components/auth/set-password-form';

export const metadata = { title: 'Primeiro acesso' };

export default function FirstAccessPage() {
  return <SetPasswordForm mode="first-access" />;
}
