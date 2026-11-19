// Notificaciones de la campana del Header según el rol de la sesión (misma lógica que `_prototipo/src/App.tsx`).
// Solo incluye documentos que la sesión puede abrir (`planificacionesWherePara`).
import { PlanifStatus, Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { planificacionesWherePara } from '@/lib/visibilidad';
import { dictamenesPaac } from '@/types/planificacion';
import type { NotificationItem } from '@/components/layout/Header';

type Usuario = { id: string; rol: UserRole; carreraId: string | null };

const APROBADOS: PlanifStatus[] = ['APROBADO_PEDAGOGICO', 'APROBADO_DISCIPLINAR', 'APROBADO_PLENO', 'FINALIZADO'];
const LEYENDA_APROBACION: Partial<Record<PlanifStatus, string>> = {
  APROBADO_PEDAGOGICO: 'Informe Pedagógico favorable de la UAP',
  APROBADO_DISCIPLINAR: 'Informe Disciplinar favorable de la Dirección de Carrera',
  APROBADO_PLENO: 'Aprobación plena: pendiente de elevación al Consejo',
  FINALIZADO: 'Planificación finalizada y protocolizada',
};

const includePlanif = {
  asignatura: { select: { nombre: true, planEstudio: { select: { carrera: { select: { codigo: true } } } } } },
  observaciones: { where: { documentoTipo: 'PAAC', resuelto: false }, select: { rolAutor: true } },
} satisfies Prisma.PlanificacionInclude;


/**
 * Lista de notificaciones del ciclo. El `id` incluye el estado y la cantidad de observaciones:
 * si el documento cambia, la notificación vuelve a figurar como no leída.
 */
export async function cargarNotificaciones(user: Usuario, ciclo: number): Promise<NotificationItem[]> {
  const out: NotificationItem[] = [];
  const add = (n: Omit<NotificationItem, 'id'> & { clave: string }) => {
    const { clave, ...resto } = n;
    out.push({ ...resto, id: `${clave}:${n.state}:${n.unresolvedCount}` });
  };

  // Ciclo: el Consejo protocoliza documentos de cualquier ciclo; Administración ve la revisión del ciclo
  // y la protocolización pendiente de todos los ciclos; el resto, solo el ciclo vigente.
  const porCiclo: Prisma.PlanificacionWhereInput =
    user.rol === UserRole.CONSEJO_DEPARTAMENTAL
      ? {}
      : user.rol === UserRole.ADMINISTRADOR
        ? { OR: [{ cicloLectivo: ciclo }, { estado: { in: ['APROBADO_PLENO', 'ELEVADO_AL_CONSEJO'] } }] }
        : { cicloLectivo: ciclo };

  const planifs = await prisma.planificacion.findMany({
    where: { AND: [planificacionesWherePara(user), porCiclo] },
    include: includePlanif,
    orderBy: { updatedAt: 'desc' },
  });

  for (const p of planifs) {
    const asig = p.asignatura.nombre;
    const carrera = p.asignatura.planEstudio.carrera.codigo;
    const abiertas = p.observaciones.length;
    const href = `/planificaciones/${p.id}`;
    const d = dictamenesPaac({ estado: p.estado, informePedagogico: p.informePedagogico, informeDisciplinar: p.informeDisciplinar, observacionesAbiertas: p.observaciones });
    const enRevision = p.estado === 'ENVIADO_A_REVISION' || p.estado === 'APROBADO_PEDAGOGICO' || p.estado === 'APROBADO_DISCIPLINAR';

    switch (user.rol) {
      case UserRole.DOCENTE:
        if (p.estado === 'OBSERVADO' || abiertas > 0) {
          add({ clave: `paac-obs-${p.id}`, tipo: 'warning', href, title: `PAAC · ${asig}`, subtitle: `${carrera} · Ciclo ${p.cicloLectivo}`, state: p.estado, unresolvedCount: abiertas });
        } else if (APROBADOS.includes(p.estado)) {
          add({ clave: `paac-ok-${p.id}`, tipo: 'success', href, title: `PAAC · ${asig}`, subtitle: `${carrera} · Ciclo ${p.cicloLectivo} · ${LEYENDA_APROBACION[p.estado] ?? ''}`, state: p.estado, unresolvedCount: 0 });
        }
        break;
      case UserRole.UAP:
        if (enRevision && !d.pedApproved) {
          add({ clave: `paac-uap-${p.id}`, tipo: 'revision', href, title: `PAAC · ${asig}`, subtitle: `${carrera} · Ciclo ${p.cicloLectivo} · Pendiente de dictamen UAP`, state: p.estado, unresolvedCount: 0 });
        }
        break;
      case UserRole.DIRECCION_CARRERA:
        if (enRevision && !d.discApproved) {
          add({ clave: `paac-dir-${p.id}`, tipo: 'revision', href, title: `PAAC · ${asig}`, subtitle: `${carrera} · Ciclo ${p.cicloLectivo} · Pendiente de dictamen Disciplinar`, state: p.estado, unresolvedCount: 0 });
        }
        break;
      case UserRole.CONSEJO_DEPARTAMENTAL:
        if (p.estado === 'APROBADO_PLENO') {
          add({ clave: `paac-exp-${p.id}`, tipo: 'revision', href: '/planificaciones?state=APROBADO_PLENO', title: `PAAC · ${asig}`, subtitle: `${carrera} · Ciclo ${p.cicloLectivo} · Listo para caratular Expediente y elevar`, state: p.estado, unresolvedCount: 0 });
        } else if (p.estado === 'ELEVADO_AL_CONSEJO') {
          add({ clave: `paac-res-${p.id}`, tipo: 'revision', href: '/planificaciones?state=ELEVADO_AL_CONSEJO', title: `PAAC · ${asig}`, subtitle: `${carrera} · Ciclo ${p.cicloLectivo} · Exp. ${p.numeroExpediente ?? '—'} · Pendiente de Resolución`, state: p.estado, unresolvedCount: 0 });
        }
        break;
      // Administración: seguimiento de todo el circuito (una notificación por documento).
      case UserRole.ADMINISTRADOR: {
        const base = `${carrera} · Ciclo ${p.cicloLectivo}`;
        if (enRevision && p.cicloLectivo === ciclo && (!d.pedApproved || !d.discApproved)) {
          const falta = !d.pedApproved && !d.discApproved ? 'Pendiente de dictamen UAP y Disciplinar' : !d.pedApproved ? 'Pendiente de dictamen UAP' : 'Pendiente de dictamen Disciplinar';
          add({ clave: `adm-rev-${p.id}`, tipo: 'revision', href, title: `PAAC · ${asig}`, subtitle: `${base} · ${falta}`, state: p.estado, unresolvedCount: 0 });
        } else if (p.estado === 'APROBADO_PLENO') {
          add({ clave: `adm-exp-${p.id}`, tipo: 'revision', href: '/planificaciones?state=APROBADO_PLENO', title: `PAAC · ${asig}`, subtitle: `${base} · Listo para cargar Expediente`, state: p.estado, unresolvedCount: 0 });
        } else if (p.estado === 'ELEVADO_AL_CONSEJO') {
          add({ clave: `adm-res-${p.id}`, tipo: 'revision', href: '/planificaciones?state=ELEVADO_AL_CONSEJO', title: `PAAC · ${asig}`, subtitle: `${base} · Exp. ${p.numeroExpediente ?? '—'} · Pendiente de Resolución`, state: p.estado, unresolvedCount: 0 });
        }
        break;
      }
    }
  }

  // ---- PAAD Anual ----
  if (user.rol === UserRole.DOCENTE) {
    const paad = await prisma.paadAnual.findUnique({
      where: { docenteId_cicloLectivo: { docenteId: user.id, cicloLectivo: ciclo } },
      select: { estado: true, observaciones: { where: { resuelto: false }, select: { id: true } } },
    });
    if (paad) {
      const abiertas = paad.observaciones.length;
      if (paad.estado === 'OBSERVADO' || abiertas > 0) {
        add({ clave: 'paad-obs', tipo: 'warning', href: '/mi-paad', title: `PAAD Anual ${ciclo}`, subtitle: `Ciclo ${ciclo} · Corregí y volvé a presentar`, state: paad.estado, unresolvedCount: abiertas });
      } else if (paad.estado === 'BORRADOR') {
        add({ clave: 'paad-borrador', tipo: 'info', href: '/mi-paad', title: `PAAD Anual ${ciclo}`, subtitle: `Ciclo ${ciclo} · Recordá completarlo y presentarlo`, state: paad.estado, unresolvedCount: 0 });
      }
    }
  } else if (user.rol === UserRole.UAP || user.rol === UserRole.DIRECCION_CARRERA || user.rol === UserRole.ADMINISTRADOR) {
    if (user.rol === UserRole.DIRECCION_CARRERA && !user.carreraId) return out;
    // Administración: además, PAAD con copias anteriores distintas que debe unificar.
    if (user.rol === UserRole.ADMINISTRADOR) {
      const conflictos = await prisma.paadAnual.findMany({
        where: { cicloLectivo: ciclo, conflictoMigracion: true },
        select: { id: true, estado: true, docente: { select: { nombre: true, apellido: true } } },
      });
      for (const p of conflictos) {
        add({ clave: `paad-conf-${p.id}`, tipo: 'warning', href: `/paads/${p.id}`, title: `PAAD Anual · ${p.docente.nombre} ${p.docente.apellido}`, subtitle: `Ciclo ${ciclo} · Copias anteriores distintas: elegir la fuente`, state: p.estado, unresolvedCount: 0 });
      }
    }
    const paads = await prisma.paadAnual.findMany({
      where: { cicloLectivo: ciclo, estado: 'ENVIADO_A_REVISION', conflictoMigracion: false, ...(user.rol === UserRole.DIRECCION_CARRERA ? { carreraEvaluadoraId: user.carreraId } : {}) },
      select: { id: true, estado: true, docente: { select: { nombre: true, apellido: true } }, carreraEvaluadora: { select: { codigo: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    for (const p of paads) {
      add({
        clave: `paad-rev-${p.id}`,
        tipo: 'revision',
        href: `/paads/${p.id}`,
        title: `PAAD Anual · ${p.docente.nombre} ${p.docente.apellido}`,
        subtitle: `Dirección ${p.carreraEvaluadora?.codigo ?? 'pendiente'} · Ciclo ${ciclo}`,
        state: p.estado,
        unresolvedCount: 0,
      });
    }
  }

  return out;
}
