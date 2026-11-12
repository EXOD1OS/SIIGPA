// Solo servidor (usa Prisma). Hidrata los componentes literales del prototipo (`src/prototipo/`) con los datos reales.
import { PaadStatus, Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { planificacionesVisiblesPara, planificacionVisiblePara } from '@/lib/visibilidad';
import { paadVisible, puedeVerPaad, PAAD_REVISABLES, type PaadActor } from '@/lib/paad';
import { dictamenesPaac } from '@/types/planificacion';
import {
  CARGO_PROTOTIPO,
  observacionDoc,
  paacDoc,
  paadDesdeDb,
  regimenPrototipo,
  type EstructuraPrototipo,
} from '@/lib/prototipo-adapter';
import type { Rol, Usuario } from '@/prototipo/types/estructura';
import type { DocPaadResumen } from '@/prototipo/lib/informes';
import type { DocumentoEditable, InformeEvaluacion, ObservacionDoc, PaacDoc } from '@/prototipo/types/planificacion';
import type { PaadContenido } from '@/prototipo/types/paad';
import type { AreaRevision } from '@/prototipo/lib/revision';

type SessionUser = { id: string; rol: UserRole; carreraId: string | null; name?: string | null };

const ROL_PROTOTIPO: Record<UserRole, Rol> = {
  DOCENTE: 'Docente',
  DIRECCION_CARRERA: 'Director',
  UAP: 'UAP',
  CONSEJO_DEPARTAMENTAL: 'Consejo',
  ADMINISTRADOR: 'Administrador',
};

/** Perfil de sesión con el que trabajan los componentes del prototipo. */
export function rolPrototipo(rol: UserRole, esResponsable = true): string {
  if (rol === UserRole.DOCENTE) return esResponsable ? 'DOCENTE_RESPONSABLE' : 'DOCENTE_AUXILIAR';
  return rol;
}

/** Estados del circuito anterior de doble conformidad del PAAD: una aprobación ya alcanza. */
export const estadoPaadPrototipo = (e: PaadStatus | string) => (e === 'APROBADO_UAP' || e === 'APROBADO_DIRECCION' ? 'APROBADO' : e);

const fecha = (d: Date | null | undefined) => (d ? d.toLocaleDateString('es-AR') : null);

// ---------------------------------------------------------------------------
// Estructura académica (asignaturas, carreras, equipos y usuarios)
// ---------------------------------------------------------------------------

export async function estructuraPrototipo(opts: { asignaturaIds: string[]; ciclo: number; usuarioIds?: string[]; todasLasCarreras?: boolean }): Promise<EstructuraPrototipo> {
  const asignaturaIds = [...new Set(opts.asignaturaIds)];
  const [asignaturas, roster, integrantes] = await Promise.all([
    prisma.asignatura.findMany({
      where: { id: { in: asignaturaIds } },
      include: { planEstudio: { include: { carrera: { include: { sede: true, departamento: true } } } }, departamentoRadicacion: true },
    }),
    prisma.asignacionCatedra.findMany({ where: { asignaturaId: { in: asignaturaIds }, cicloLectivo: opts.ciclo } }),
    prisma.integrantePlanificacion.findMany({
      where: { planificacion: { asignaturaId: { in: asignaturaIds }, cicloLectivo: opts.ciclo } },
      include: { planificacion: { select: { asignaturaId: true, docenteResponsableId: true } } },
    }),
  ]);

  // Equipo de cátedra: roster del ciclo + integrantes de la planificación que no figuren en él.
  const equipos = roster.map((r) => ({ id: r.id, asignaturaId: r.asignaturaId, docenteId: r.docenteId, cicloLectivo: r.cicloLectivo, cargo: CARGO_PROTOTIPO[r.categoria] ?? r.categoria, esResponsable: r.esResponsable }));
  for (const i of integrantes) {
    if (equipos.some((e) => e.asignaturaId === i.planificacion.asignaturaId && e.docenteId === i.docenteId)) continue;
    equipos.push({
      id: i.id,
      asignaturaId: i.planificacion.asignaturaId,
      docenteId: i.docenteId,
      cicloLectivo: opts.ciclo,
      cargo: CARGO_PROTOTIPO[i.cargoEnCatedra] ?? i.cargoEnCatedra,
      esResponsable: i.planificacion.docenteResponsableId === i.docenteId,
    });
  }

  const carrerasDb = opts.todasLasCarreras
    ? await prisma.carrera.findMany({ include: { sede: true, departamento: true }, orderBy: { codigo: 'asc' } })
    : [...new Map(asignaturas.map((a) => [a.planEstudio.carrera.id, a.planEstudio.carrera])).values()];
  const carreraIds = carrerasDb.map((c) => c.id);
  const directores = await prisma.usuario.findMany({ where: { rol: UserRole.DIRECCION_CARRERA, carreraId: { in: carreraIds } }, select: { id: true, carreraId: true } });
  const usuarioIds = [...new Set([...equipos.map((e) => e.docenteId), ...(opts.usuarioIds ?? [])])];
  const usuariosDb = await prisma.usuario.findMany({
    where: { id: { in: usuarioIds } },
    select: { id: true, nombre: true, apellido: true, dni: true, email: true, rol: true, carreraId: true, mustChangePassword: true },
  });

  const departamentos = new Map<string, { id: string; nombre: string; sedeId: string }>();
  for (const c of carrerasDb) departamentos.set(c.departamento.id, { id: c.departamento.id, nombre: c.departamento.nombre, sedeId: c.sedeId });
  for (const a of asignaturas) {
    const d = a.departamentoRadicacion;
    if (!departamentos.has(d.id)) departamentos.set(d.id, { id: d.id, nombre: d.nombre, sedeId: a.planEstudio.carrera.sedeId });
  }

  return {
    ciclo: opts.ciclo,
    sedes: [...new Map(carrerasDb.map((c) => [c.sede.id, { id: c.sede.id, nombre: c.sede.nombre, esCapital: c.sede.esCapital }])).values()],
    departamentos: [...departamentos.values()],
    carreras: carrerasDb.map((c) => ({
      id: c.id,
      codigo: c.codigo,
      sigla: c.codigo,
      nombre: c.nombre,
      sedeId: c.sedeId,
      departamentoId: c.departamentoId,
      directorId: directores.find((d) => d.carreraId === c.id)?.id ?? '',
    })),
    planes: [...new Map(asignaturas.map((a) => [a.planEstudio.id, a.planEstudio])).values()].map((p) => ({
      id: p.id,
      carreraId: p.carreraId,
      ordenanza: p.ordenanza,
      enfoque: p.enfoque === 'COMPETENCIAS' ? 'COMPETENCIAS' : 'TRADICIONAL',
      activo: p.activo,
    })),
    asignaturas: asignaturas.map((a) => ({
      id: a.id,
      planEstudioId: a.planEstudioId,
      departamentoRadicacionId: a.departamentoRadicacionId,
      codigo: '',
      nombre: a.nombre,
      anoCursada: a.anoCursada,
      regimenDictado: regimenPrototipo(a.regimen),
      // La base guarda el crédito horario total; las horas semanales se estiman sobre 16 (cuatrimestral) o 32 (anual) semanas.
      horasTotales: a.creditoHorario,
      horasSemanales: Math.round(a.creditoHorario / (a.regimen === 'ANUAL' ? 32 : 16)),
      contenidosMinimos: a.contenidosMinimosOficiales,
    })),
    usuarios: usuariosDb.map(
      (u): Usuario => ({ id: u.id, nombre: u.nombre, apellido: u.apellido, dni: u.dni, email: u.email, rol: ROL_PROTOTIPO[u.rol], carreraId: u.carreraId, mustChangePassword: u.mustChangePassword, activo: true }),
    ),
    equipos,
  };
}

// ---------------------------------------------------------------------------
// PAAD: resúmenes y documento
// ---------------------------------------------------------------------------

const paadInclude = {
  carreraEvaluadora: { select: { nombre: true } },
  observaciones: { include: { autor: { select: { nombre: true, apellido: true } } }, orderBy: { createdAt: 'asc' as const } },
  presentaciones: { orderBy: { numero: 'desc' as const }, take: 1, include: { dictamenes: { include: { autor: { select: { nombre: true, apellido: true } } } } } },
};

type PaadConRevision = Prisma.PaadAnualGetPayload<{ include: typeof paadInclude }>;

/** Dictámenes de la última presentación → aprobaciones e informes del prototipo. */
function aprobacionesPaad(p: PaadConRevision) {
  const dict = p.presentaciones[0]?.dictamenes ?? [];
  const informe = (rol: UserRole): InformeEvaluacion | undefined => {
    const d = dict.find((x) => x.rolAutor === rol);
    return d ? { items: {}, dictamen: d.resultado === 'FAVORABLE' ? 'APROBADO' : 'OBSERVADO', by: `${d.autor.nombre} ${d.autor.apellido}`, fecha: d.createdAt.toLocaleDateString('es-AR') } : undefined;
  };
  const pedReport = informe(UserRole.UAP);
  const discReport = informe(UserRole.DIRECCION_CARRERA);
  return { pedReport, discReport, pedApproved: pedReport?.dictamen === 'APROBADO' || p.estado === 'APROBADO_UAP', discApproved: discReport?.dictamen === 'APROBADO' || p.estado === 'APROBADO_DIRECCION' };
}

export interface PaadResumenPrototipo {
  id: string;
  owner: string;
  state: string;
  cycle: number;
  evalCareer: string;
  carreraEvalNombre: string;
  pedApproved: boolean;
  discApproved: boolean;
  pedReport?: InformeEvaluacion;
  discReport?: InformeEvaluacion;
  comments: ObservacionDoc[];
  paad: PaadContenido;
}

function resumenPaad(p: PaadConRevision): PaadResumenPrototipo {
  return {
    id: p.id,
    owner: p.docenteId,
    state: estadoPaadPrototipo(p.estado),
    cycle: p.cicloLectivo,
    evalCareer: p.carreraEvaluadoraId ?? '',
    carreraEvalNombre: p.carreraEvaluadora?.nombre ?? 'Dirección pendiente',
    ...aprobacionesPaad(p),
    comments: p.observaciones.map((o) => observacionDoc(o, 'paad')),
    paad: paadDesdeDb(p.datosPaad),
  };
}

/** Editor del PAAD (Mi PAAD Anual / Ver PAAD): documento, cátedras del docente y permisos de la sesión. */
export async function cargarPaadPrototipo(actor: PaadActor & { name?: string | null }, paadId: string) {
  const base = await paadVisible(prisma, actor, paadId).catch(() => null);
  if (!base) return null;
  const p = (await prisma.paadAnual.findUniqueOrThrow({ where: { id: paadId }, include: paadInclude })) as PaadConRevision;
  const resumen = resumenPaad(p);

  const [roster, integrantes] = await Promise.all([
    prisma.asignacionCatedra.findMany({ where: { docenteId: p.docenteId, cicloLectivo: p.cicloLectivo }, select: { asignaturaId: true } }),
    prisma.integrantePlanificacion.findMany({ where: { docenteId: p.docenteId, planificacion: { cicloLectivo: p.cicloLectivo } }, select: { planificacion: { select: { asignaturaId: true } } } }),
  ]);
  const E = await estructuraPrototipo({
    asignaturaIds: [...roster.map((r) => r.asignaturaId), ...integrantes.map((i) => i.planificacion.asignaturaId)],
    ciclo: p.cicloLectivo,
    usuarioIds: [p.docenteId],
  });

  const propio = actor.rol === UserRole.ADMINISTRADOR || (actor.rol === UserRole.DOCENTE && actor.id === p.docenteId);
  const editable = propio && !p.conflictoMigracion && ['BORRADOR', 'OBSERVADO'].includes(p.estado);
  const revisor = actor.rol === UserRole.UAP || (actor.rol === UserRole.DIRECCION_CARRERA && !!actor.carreraId && actor.carreraId === p.carreraEvaluadoraId);
  const revision = p.presentaciones[0];
  const revisable = revisor && !p.conflictoMigracion && PAAD_REVISABLES.includes(p.estado) && !!revision && !revision.dictamenes.some((d) => d.rolAutor === actor.rol);
  const area: AreaRevision | null = actor.rol === UserRole.UAP ? 'uap' : actor.rol === UserRole.DIRECCION_CARRERA ? 'direccion' : null;

  const d: DocumentoEditable = {
    id: p.id,
    type: 'PAAD',
    owner: p.docenteId,
    cycle: p.cicloLectivo,
    state: resumen.state,
    data: {},
    paad: resumen.paad,
    comments: resumen.comments,
    pedReport: resumen.pedReport,
    discReport: resumen.discReport,
  };

  return {
    d,
    E,
    role: rolPrototipo(actor.rol),
    uid: actor.id,
    presentacionId: revision?.id ?? null,
    carreraEvaluadoraId: p.carreraEvaluadoraId,
    puedePresentar: editable && !!p.carreraEvaluadoraId,
    conflictoMigracion: p.conflictoMigracion,
    permisos: {
      canEdit: editable,
      canSubmit: editable && !!p.carreraEvaluadoraId,
      canObserve: revisable,
      revisionArea: revisable ? area : null,
    },
  };
}

// ---------------------------------------------------------------------------
// PAAC: documento del editor
// ---------------------------------------------------------------------------

/** PAAD del equipo de cátedra (vista rápida PaadModal + estado "Presentó / No Presentó" de los informes). */
async function paadsDelEquipo(docenteIds: string[], ciclo: number) {
  const paads = (await prisma.paadAnual.findMany({ where: { docenteId: { in: docenteIds }, cicloLectivo: ciclo }, include: paadInclude })) as PaadConRevision[];
  return paads.map(resumenPaad);
}

export async function cargarPaacPrototipo(user: SessionUser, planifId: string) {
  const planif = await planificacionVisiblePara(user, planifId);
  if (!planif) return null;
  const autores = await prisma.usuario.findMany({ where: { id: { in: [...new Set(planif.observaciones.map((o) => o.autorId))] } }, select: { id: true, nombre: true, apellido: true } });
  const comments = planif.observaciones.map((o) => observacionDoc({ ...o, autor: autores.find((a) => a.id === o.autorId) }, 'paac'));
  const { pedApproved, discApproved } = dictamenesPaac({
    estado: planif.estado,
    informePedagogico: planif.informePedagogico,
    informeDisciplinar: planif.informeDisciplinar,
    observacionesAbiertas: planif.observaciones.filter((o) => !o.resuelto),
  });

  const doc: PaacDoc = paacDoc({
    id: planif.id,
    asignaturaId: planif.asignaturaId,
    responsableId: planif.docenteResponsableId,
    ciclo: planif.cicloLectivo,
    regimen: planif.asignatura.regimen,
    estado: planif.estado,
    datosPaac: planif.datosPaac,
    informePedagogico: planif.informePedagogico,
    informeDisciplinar: planif.informeDisciplinar,
    pedApproved,
    discApproved,
    expediente: planif.numeroExpediente,
    resolucion: planif.numeroResolucion,
    fechaElevacion: fecha(planif.fechaElevacion),
    fechaResolucion: fecha(planif.fechaAprobacionCd),
    comments,
  });

  const E0 = await estructuraPrototipo({ asignaturaIds: [planif.asignaturaId], ciclo: planif.cicloLectivo, usuarioIds: [planif.docenteResponsableId] });
  const equipoIds = [...new Set(E0.equipos.map((e) => e.docenteId))];
  const paads = await paadsDelEquipo(equipoIds, planif.cicloLectivo);
  const docs: DocPaadResumen[] = paads.map((p) => ({ type: 'PAAD', owner: p.owner, state: p.state, cycle: p.cycle }));
  // Catedras de cada integrante (para proyectar los Aspectos Generales de su PAAD en la vista rápida).
  const otrasAsignaturas = await prisma.asignacionCatedra.findMany({ where: { docenteId: { in: equipoIds }, cicloLectivo: planif.cicloLectivo }, select: { asignaturaId: true } });
  // Superconjunto: la asignatura del PAAC + las demás cátedras de los integrantes (proyección de sus PAAD).
  const E = await estructuraPrototipo({
    asignaturaIds: otrasAsignaturas.map((a) => a.asignaturaId).concat(planif.asignaturaId),
    ciclo: planif.cicloLectivo,
    usuarioIds: [...equipoIds, planif.docenteResponsableId],
  });

  const rol = user.rol;
  const esResponsable = planif.docenteResponsableId === user.id;
  const editable = (esResponsable || rol === UserRole.ADMINISTRADOR) && ['BORRADOR', 'OBSERVADO'].includes(planif.estado);
  const enRevision = ['ENVIADO_A_REVISION', 'APROBADO_PEDAGOGICO', 'APROBADO_DISCIPLINAR'].includes(planif.estado);
  const area: AreaRevision | null = rol === UserRole.UAP ? 'uap' : rol === UserRole.DIRECCION_CARRERA ? 'direccion' : null;
  const areaAbierta = area === 'uap' ? !pedApproved : area === 'direccion' ? !discApproved : false;
  const revisionArea = enRevision && areaAbierta ? area : null;

  return {
    doc,
    E,
    docs,
    paads,
    role: rolPrototipo(rol, esResponsable),
    uid: user.id,
    permisos: {
      canEdit: editable,
      canSubmit: editable,
      canObserve: !!revisionArea,
      revisionArea,
      /** UAP / Dirección consultan su informe desde el PAAC (prototipo: `puedeIrAlInforme`). */
      areaSesion: area,
      protocolizar: rol === UserRole.CONSEJO_DEPARTAMENTAL || rol === UserRole.ADMINISTRADOR,
    },
  };
}

// ---------------------------------------------------------------------------
// Bandejas
// ---------------------------------------------------------------------------

/** Bandeja de planificaciones (PlanificacionesList del prototipo). */
export async function cargarBandejaPaac(user: SessionUser) {
  const planificaciones = await planificacionesVisiblesPara(user);
  const ciclo = new Date().getFullYear();
  const obs = await prisma.itemObservacion.findMany({
    where: { planificacionId: { in: planificaciones.map((p) => p.id) }, documentoTipo: 'PAAC' },
    select: { id: true, planificacionId: true, campoPath: true, mensaje: true, resuelto: true, rolAutor: true, createdAt: true },
  });
  const paacs = planificaciones.map((p) => {
    const propias = obs.filter((o) => o.planificacionId === p.id);
    const { pedApproved, discApproved } = dictamenesPaac({
      estado: p.estado,
      informePedagogico: p.informePedagogico,
      informeDisciplinar: p.informeDisciplinar,
      observacionesAbiertas: propias.filter((o) => !o.resuelto),
    });
    return paacDoc({
      id: p.id,
      asignaturaId: p.asignaturaId,
      responsableId: p.docenteResponsableId,
      ciclo: p.cicloLectivo,
      regimen: p.asignatura.regimen,
      estado: p.estado,
      datosPaac: p.datosPaac,
      informePedagogico: p.informePedagogico,
      informeDisciplinar: p.informeDisciplinar,
      pedApproved,
      discApproved,
      expediente: p.numeroExpediente,
      resolucion: p.numeroResolucion,
      fechaElevacion: fecha(p.fechaElevacion),
      fechaResolucion: fecha(p.fechaAprobacionCd),
      comments: propias.map((o) => observacionDoc(o, 'paac')),
    });
  });
  const E = await estructuraPrototipo({
    asignaturaIds: planificaciones.map((p) => p.asignaturaId),
    ciclo,
    usuarioIds: planificaciones.map((p) => p.docenteResponsableId),
    todasLasCarreras: user.rol === UserRole.UAP || user.rol === UserRole.CONSEJO_DEPARTAMENTAL || user.rol === UserRole.ADMINISTRADOR,
  });
  const docentes = [...new Set(E.equipos.map((e) => e.docenteId))];
  const paads = await prisma.paadAnual.findMany({ where: { docenteId: { in: docentes } }, select: { docenteId: true, estado: true, cicloLectivo: true } });
  const docs: DocPaadResumen[] = paads.map((p) => ({ type: 'PAAD', owner: p.docenteId, state: estadoPaadPrototipo(p.estado), cycle: p.cicloLectivo }));
  return { paacs, E, docs, role: rolPrototipo(user.rol), uid: user.id, careerId: user.carreraId ?? '' };
}

/** Bandeja de PAAD (PaadsListView del prototipo). */
export async function cargarBandejaPaad(user: SessionUser, ciclo: number) {
  const candidatos = (await prisma.paadAnual.findMany({ where: { cicloLectivo: ciclo }, include: paadInclude, orderBy: { updatedAt: 'desc' } })) as PaadConRevision[];
  const permisos = await Promise.all(candidatos.map((p) => puedeVerPaad(prisma, user, p)));
  const visibles = candidatos.filter((_, i) => permisos[i]);
  const docentes = visibles.map((p) => p.docenteId);
  const [roster, integrantes] = await Promise.all([
    prisma.asignacionCatedra.findMany({ where: { docenteId: { in: docentes }, cicloLectivo: ciclo }, select: { asignaturaId: true } }),
    prisma.integrantePlanificacion.findMany({ where: { docenteId: { in: docentes }, planificacion: { cicloLectivo: ciclo } }, select: { planificacion: { select: { asignaturaId: true } } } }),
  ]);
  const E = await estructuraPrototipo({
    asignaturaIds: [...roster.map((r) => r.asignaturaId), ...integrantes.map((i) => i.planificacion.asignaturaId)],
    ciclo,
    usuarioIds: docentes,
    todasLasCarreras: true,
  });
  return { paads: visibles.map(resumenPaad), E, role: rolPrototipo(user.rol) };
}
