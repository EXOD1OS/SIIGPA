import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { dictamenesPaac, progresoSecciones } from '@/types/planificacion';
import type { DatosDashboard, ObsResumen, PaacResumen, PaadResumen } from '@/components/dashboards/datos';

type Usuario = { id: string; rol: UserRole; carreraId: string | null; name?: string | null };

const AREA: Partial<Record<UserRole, ObsResumen['area']>> = { UAP: 'uap', DIRECCION_CARRERA: 'direccion' };

const obs = (o: { id: string; resuelto: boolean; rolAutor: UserRole; campoPath: string; mensaje: string }): ObsResumen => ({
  id: o.id,
  resolved: o.resuelto,
  area: AREA[o.rolAutor],
  campoPath: o.campoPath && o.campoPath !== 'general' ? o.campoPath : undefined,
  text: o.mensaje,
});

/** Avance del PAAC sin contar el encabezado (se precarga con los datos de la asignatura). */
export function avancePaac(datosPaac: unknown): { pct: number; iniciado: boolean } {
  const resto = datosPaac && typeof datosPaac === 'object' ? { ...(datosPaac as Record<string, unknown>) } : {};
  delete resto.encabezado;
  const p = progresoSecciones(resto);
  return { pct: p.pct, iniciado: p.completados > 0 };
}

const includePlanif = {
  asignatura: { include: { planEstudio: { include: { carrera: true } } } },
  docenteResponsable: { select: { nombre: true, apellido: true } },
  integrantes: { select: { docenteId: true, cargoEnCatedra: true } },
  observaciones: {
    where: { documentoTipo: 'PAAC' },
    select: { id: true, resuelto: true, rolAutor: true, campoPath: true, mensaje: true },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.PlanificacionInclude;

/**
 * Datos de Inicio por rol. Los totales de UAP, Dirección y Consejo cubren el padrón departamental
 * (como en el prototipo); la navegación a documentos respeta `lib/visibilidad.ts` en cada vista.
 */
export async function cargarDatosDashboard(user: Usuario, ciclo: number): Promise<DatosDashboard> {
  const esDocente = user.rol === UserRole.DOCENTE;
  const whereCiclo: Prisma.PlanificacionWhereInput = user.rol === UserRole.CONSEJO_DEPARTAMENTAL ? {} : { cicloLectivo: ciclo };
  const wherePlanif: Prisma.PlanificacionWhereInput = esDocente
    ? { ...whereCiclo, OR: [{ docenteResponsableId: user.id }, { integrantes: { some: { docenteId: user.id } } }] }
    : whereCiclo;

  const [planificaciones, paadsDb, carreras, asignaturas] = await Promise.all([
    prisma.planificacion.findMany({ where: wherePlanif, include: includePlanif, orderBy: { updatedAt: 'desc' } }),
    user.rol === UserRole.CONSEJO_DEPARTAMENTAL
      ? Promise.resolve([])
      : prisma.paadAnual.findMany({
          where: { cicloLectivo: ciclo, ...(esDocente ? { docenteId: user.id } : {}) },
          include: {
            docente: { select: { nombre: true, apellido: true } },
            observaciones: { select: { id: true, resuelto: true, rolAutor: true, campoPath: true, mensaje: true }, orderBy: { createdAt: 'desc' } },
          },
        }),
    esDocente ? Promise.resolve([]) : prisma.carrera.findMany({ select: { id: true, codigo: true, nombre: true }, orderBy: { codigo: 'asc' } }),
    user.rol === UserRole.DIRECCION_CARRERA
      ? prisma.asignatura.findMany({
          where: { planEstudio: { activo: true } },
          select: {
            planEstudio: { select: { carreraId: true } },
            asignacionesCatedra: { where: { cicloLectivo: ciclo, esResponsable: true }, select: { id: true }, take: 1 },
          },
        })
      : Promise.resolve([]),
  ]);

  const paacs: PaacResumen[] = planificaciones.map((p) => {
    const carrera = p.asignatura.planEstudio.carrera;
    const abiertas = p.observaciones.filter((o) => !o.resuelto);
    const d = dictamenesPaac({ estado: p.estado, informePedagogico: p.informePedagogico, informeDisciplinar: p.informeDisciplinar, observacionesAbiertas: abiertas });
    return {
      id: p.id,
      asignatura: p.asignatura.nombre,
      carreraId: carrera.id,
      carreraSigla: carrera.codigo,
      evalCarreraId: p.asignatura.carreraEvaluadoraId ?? carrera.id,
      ordenanza: p.asignatura.planEstudio.ordenanza,
      regimen: p.asignatura.regimen,
      cycle: p.cicloLectivo,
      state: p.estado,
      responsableId: p.docenteResponsableId,
      responsable: `${p.docenteResponsable.nombre} ${p.docenteResponsable.apellido}`,
      equipo: p.integrantes.map((i) => ({ docenteId: i.docenteId, cargo: i.cargoEnCatedra })),
      pedApproved: d.pedApproved,
      discApproved: d.discApproved,
      ped: d.ped,
      disc: d.disc,
      avance: avancePaac(p.datosPaac).pct,
      expediente: p.numeroExpediente,
      resolucion: p.numeroResolucion,
      fechaElevacion: p.fechaElevacion ? p.fechaElevacion.toLocaleDateString('es-AR') : null,
      comments: p.observaciones.map(obs),
    };
  });

  const paads: PaadResumen[] = paadsDb.map((p) => ({
    id: p.id,
    owner: p.docenteId,
    ownerName: `${p.docente.nombre} ${p.docente.apellido}`,
    // Circuito anterior de doble conformidad: una aprobación ya alcanza.
    state: p.estado === 'APROBADO_UAP' || p.estado === 'APROBADO_DIRECCION' ? 'APROBADO' : p.estado,
    cycle: p.cicloLectivo,
    evalCareer: p.carreraEvaluadoraId,
    comments: p.observaciones.map(obs),
    progreso: progresoSecciones(p.datosPaad),
  }));

  const cobertura: DatosDashboard['cobertura'] = {};
  for (const a of asignaturas) {
    const c = (cobertura[a.planEstudio.carreraId] ??= { asignaturas: 0, cubiertas: 0 });
    c.asignaturas += 1;
    if (a.asignacionesCatedra.length) c.cubiertas += 1;
  }

  return {
    uid: user.id,
    nombre: user.name ?? 'Usuario',
    ciclo,
    paacs,
    paads,
    carreras: carreras.map((c) => ({ id: c.id, sigla: c.codigo, nombre: c.nombre })),
    cobertura,
  };
}
