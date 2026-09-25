import { SetPasswordForm } from '@/components/auth/set-password-form';

export const metadata = { title: 'Criar nova senha' };

export default function ResetPasswordPage() {
  return <SetPasswordForm mode="reset" />;
}
