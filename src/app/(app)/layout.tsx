import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/layout/Header';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  // Si la cuenta usa una contraseña provisoria, el Header abre el modal obligatorio sobre la vista actual.
  return (
    <div className="flex min-h-screen flex-col bg-background text-ink md:flex-row">
      <Sidebar rol={session.user.rol} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header nombre={session.user.name ?? ''} rol={session.user.rol} mustChangePassword={!!session.user.mustChangePassword} />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 xl:px-8 xl:py-8">{children}</main>
      </div>
    </div>
  );
}
