import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { AdminEstructuraView } from '@/components/admin/AdminEstructuraView';
import { GenerarPlanificacionesPanel } from '@/components/admin/GenerarPlanificacionesPanel';
import type { EstructuraAdmin } from '@/components/admin/tipos';

/** Estructura Académica y Equipos de Cátedra (Administración). */
export default async function AdminHubPage({ searchParams }: { searchParams?: { ciclo?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.rol !== UserRole.ADMINISTRADOR) redirect('/dashboard');

  const anio = new Date().getFullYear();
  const solicitado = Number(searchParams?.ciclo);
  const ciclo = Number.isInteger(solicitado) && solicitado >= 2000 && solicitado <= 2100 ? solicitado : anio;

  const [sedes, departamentos, carreras, planes, asignaturas, docentes, asignaciones, planificaciones, directores, ciclosDb] = await Promise.all([
    prisma.sede.findMany({ orderBy: [{ esCapital: 'desc' }, { nombre: 'asc' }] }),
    prisma.departamento.findMany({ orderBy: { nombre: 'asc' } }),
    prisma.carrera.findMany({ orderBy: { codigo: 'asc' } }),
    prisma.planEstudio.findMany({ orderBy: { ordenanza: 'asc' } }),
    prisma.asignatura.findMany({ include: { planEstudio: { select: { carreraId: true } } }, orderBy: [{ anoCursada: 'asc' }, { nombre: 'asc' }] }),
    prisma.usuario.findMany({ where: { rol: UserRole.DOCENTE }, select: { id: true, nombre: true, apellido: true, email: true, dni: true }, orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }] }),
    prisma.asignacionCatedra.findMany({ where: { cicloLectivo: ciclo }, select: { asignaturaId: true, docenteId: true, categoria: true, esResponsable: true } }),
    prisma.planificacion.findMany({ where: { cicloLectivo: ciclo }, select: { asignaturaId: true, estado: true } }),
    prisma.usuario.findMany({ where: { rol: UserRole.DIRECCION_CARRERA, carreraId: { not: null } }, select: { carreraId: true, nombre: true, apellido: true } }),
    prisma.asignacionCatedra.findMany({ select: { cicloLectivo: true }, distinct: ['cicloLectivo'] }),
  ]);

  const directorDe = new Map(directores.map((d) => [d.carreraId, `${d.nombre} ${d.apellido}`]));
  const S: EstructuraAdmin = {
    ciclo,
    sedes: sedes.map(({ id, nombre, esCapital }) => ({ id, nombre, esCapital })),
    departamentos: departamentos.map(({ id, nombre }) => ({ id, nombre })),
    carreras: carreras.map((c) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre, sedeId: c.sedeId, departamentoId: c.departamentoId, director: directorDe.get(c.id) ?? null })),
    planes: planes.map(({ id, ordenanza, enfoque, carreraId }) => ({ id, ordenanza, enfoque, carreraId })),
    asignaturas: asignaturas.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      anoCursada: a.anoCursada,
      regimen: a.regimen,
      creditoHorario: a.creditoHorario,
      contenidosMinimos: a.contenidosMinimosOficiales,
      planId: a.planEstudioId,
      carreraId: a.planEstudio.carreraId,
      departamentoRadicacionId: a.departamentoRadicacionId,
    })),
    docentes,
    asignaciones,
    estadoPlanif: Object.fromEntries(planificaciones.map((p) => [p.asignaturaId, p.estado])),
  };
  const ciclos = [...new Set([anio, anio + 1, ciclo, ...ciclosDb.map((c) => c.cicloLectivo)])].sort((a, b) => b - a);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Estructura Académica y Equipos de Cátedra</h1>
          <p className="mt-0.5 text-xs text-muted">
            Navegá el árbol institucional (Sede → Departamento → Carrera → Plan → Asignatura). Usá «Detalle» en una carrera o «Equipo de cátedra» en una
            asignatura para gestionarla.
          </p>
        </div>
        <AdminTabs />
      </div>

      <section aria-labelledby="ciclo-heading" className="grid gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)] lg:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Ciclo lectivo</p>
          <h2 id="ciclo-heading" className="mt-1 text-base font-bold text-ink">
            Preparar planificaciones docentes
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Crea los borradores PAAC por materia y los PAAD personales por docente, tomando como referencia los equipos del ciclo anterior. Las materias sin
            equipo quedan señaladas para completarlas desde la estructura.
          </p>
        </div>
        <GenerarPlanificacionesPanel />
      </section>

      <AdminEstructuraView S={S} ciclos={ciclos} />
    </div>
  );
}
