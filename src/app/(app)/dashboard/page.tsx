import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cargarDatosDashboard } from '@/lib/dashboard-datos';
import { DashboardInicio } from '@/components/dashboards/DashboardInicio';

/** Inicio por rol (Docente, UAP, Dirección de Carrera, Consejo Departamental y Administración). */
export default async function DashboardPage({ searchParams }: { searchParams?: { ciclo?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const solicitado = Number(searchParams?.ciclo);
  const ciclo = Number.isInteger(solicitado) && solicitado >= 2000 && solicitado <= 2100 ? solicitado : new Date().getFullYear();
  const datos = await cargarDatosDashboard(session.user, ciclo);

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <DashboardInicio rol={session.user.rol} datos={datos} carreraId={session.user.carreraId ?? null} />
    </div>
  );
}
