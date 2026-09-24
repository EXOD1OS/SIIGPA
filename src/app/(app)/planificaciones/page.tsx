import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { planificacionesVisiblesPara } from '@/lib/visibilidad';
import { PlanificacionesList } from '@/components/PlanificacionesList';

export default async function PlanificacionesPage() {
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
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-white">Planificaciones</h1>
      {session.user.rol === 'ADMINISTRADOR' && (
        <p className="text-gray-400 text-sm mt-1">
          Todas las planificaciones del sistema, filtrables por sede, período, carrera y estado.
        </p>
      )}

      <PlanificacionesList planificaciones={rows} rol={session.user.rol} />
    </div>
  );
}
