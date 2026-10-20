import Image from 'next/image';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { planificacionesVisiblesPara } from '@/lib/visibilidad';
import { PlanificacionesList } from '@/components/PlanificacionesList';

export default async function PlanificacionesPage({
  searchParams,
}: {
  searchParams?: { estado?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const planificaciones = await planificacionesVisiblesPara(session.user);
  const rows = planificaciones.map((p) => ({
    id: p.id,
    estado: p.estado,
    cicloLectivo: p.cicloLectivo,
    regimen: p.asignatura.regimen,
    numeroExpediente: p.numeroExpediente,
    numeroResolucion: p.numeroResolucion,
    fechaAprobacionCd: p.fechaAprobacionCd ? p.fechaAprobacionCd.toISOString() : null,
    asignatura: {
      nombre: p.asignatura.nombre,
      planEstudio: {
        carrera: {
          nombre: p.asignatura.planEstudio.carrera.nombre,
          codigo: p.asignatura.planEstudio.carrera.codigo,
          sede: { nombre: p.asignatura.planEstudio.carrera.sede.nombre },
        },
      },
    },
    docenteResponsable: { nombre: p.docenteResponsable.nombre, apellido: p.docenteResponsable.apellido },
  }));

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-blue-200/10 bg-gradient-to-r from-[#10213d] via-[#0d1b32] to-[#101a38] p-5 shadow-lg shadow-blue-950/20 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-28 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Gestión académica</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Planificaciones</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-300">
            {session.user.rol === 'ADMINISTRADOR'
              ? 'Consultá, filtrá y revisá las planificaciones de todas las carreras.'
              : 'Consultá tus planificaciones y encontrá rápidamente cada ciclo y estado.'}
          </p>
        </div>
        <div className="relative mt-4 flex w-fit items-center self-start rounded-xl border border-white/10 bg-[#071326]/35 px-5 py-4 shadow-lg backdrop-blur-sm sm:mt-0 sm:self-auto">
          <Image src="/unlar-logo.png" alt="Universidad Nacional de La Rioja" width={311} height={104} priority className="h-auto w-52 object-contain sm:w-60" />
        </div>
      </header>

      <PlanificacionesList planificaciones={rows} rol={session.user.rol} initialEstado={searchParams?.estado} />
    </div>
  );
}
