import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PaadDetail } from '@/components/PaadDetail';

export default async function PaadPage({ params, searchParams }: { params: { id: string }; searchParams?: { asignatura?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  // `?asignatura=` proyecta los Aspectos Generales según la materia desde la que se consulta.
  return <PaadDetail id={params.id} actor={session.user} asignaturaId={searchParams?.asignatura} />;
}