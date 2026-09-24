import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Sidebar } from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (session.user.mustChangePassword) redirect('/cambiar-password');

  return (
    <div className="flex">
      <Sidebar nombre={session.user.name ?? ''} rol={session.user.rol} />
      <main className="flex-1 min-h-screen px-8 py-8">{children}</main>
    </div>
  );
}
