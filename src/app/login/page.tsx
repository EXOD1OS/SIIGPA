import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import LoginForm from './login-form';

type LoginPageProps = {
  searchParams?: { callbackUrl?: string | string[]; passwordChanged?: string };
};

function safeDestination(value?: string | string[]) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('\\')
    ? candidate
    : '/dashboard';
}

/** Ingreso institucional al SIIGPA (diseño del prototipo, autenticación real con NextAuth). */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const destination = safeDestination(searchParams?.callbackUrl);
  const session = await getServerSession(authOptions);

  if (session?.user) redirect(destination);

  return <LoginForm callbackUrl={destination} passwordChanged={searchParams?.passwordChanged === '1'} />;
}
