import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PaadPagina } from '@/components/documentos/PaadPagina';

/** Ver PAAD: `?asignatura=` / `?carrera=` proyectan los Aspectos Generales desde la cátedra consultada. */
export default async function PaadPage({ params, searchParams }: { params: { id: string }; searchParams?: { asignatura?: string; carrera?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return <PaadPagina id={params.id} actor={session.user} asignaturaId={searchParams?.asignatura} carreraId={searchParams?.carrera} />;
}