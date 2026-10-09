import { prisma } from '@/lib/prisma';
import { carrerasPaad, paadVisible, PAAD_LABELS, PAAD_REVISABLES, type PaadActor } from '@/lib/paad';
import { PaadForm } from './forms/PaadForm';
import { PaadControls } from './forms/PaadControls';
import { PaadDocumentView } from './documents/PaadDocumentView';
import { ObservationFieldWrapper } from './ObservationFieldWrapper';
import { ViewToggle } from './ViewToggle';
import { notFound } from 'next/navigation';
import type { PaadData } from '@/types/planificacion';

export async function PaadDetail({ id, actor }: { id: string; actor: PaadActor }) {
  const p = await paadVisible(prisma, actor, id).catch(() => null);
  if (!p) notFound();
  const propio = actor.rol === 'ADMINISTRADOR' || (actor.rol === 'DOCENTE' && actor.id === p.docenteId);
  const editable = propio && !p.conflictoMigracion && ['BORRADOR', 'OBSERVADO'].includes(p.estado);
  const revision = p.presentaciones[0];
  const revisor = actor.rol === 'UAP' || (actor.rol === 'DIRECCION_CARRERA' && !!actor.carreraId && actor.carreraId === p.carreraEvaluadoraId);
  const revisable = revisor && !p.conflictoMigracion && PAAD_REVISABLES.includes(p.estado);
  const carrerasIds = await carrerasPaad(prisma, p.docenteId, p.cicloLectivo);
  const carreras = actor.rol === 'ADMINISTRADOR' ? await prisma.carrera.findMany({
    where: carrerasIds.length ? { id: { in: carrerasIds } } : {}, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' },
  }) : [];
  const copias = await prisma.paadDocente.findMany({ where: { docenteId: p.docenteId, planificacion: { cicloLectivo: p.cicloLectivo } },
    include: { planificacion: { select: { id: true, asignatura: { select: { nombre: true } } } } }, orderBy: { updatedAt: 'desc' } });
  const obsLegacy = copias.length ? await prisma.itemObservacion.findMany({
    where: { documentoTipo: 'PAAD', planificacionId: { in: copias.map(c => c.planificacionId) } }, orderBy: { createdAt: 'asc' },
  }) : [];
  const nombre = p.docente.nombre + ' ' + p.docente.apellido;
  return <div className="max-w-4xl space-y-6 pb-12">
    <header><h1 className="text-2xl font-semibold">PAAD anual · {nombre}</h1>
      <p className="text-gray-400">Ciclo {p.cicloLectivo} · {PAAD_LABELS[p.estado]}</p>
      <p className="text-gray-400">Dirección responsable: {p.carreraEvaluadora?.nombre ?? 'Pendiente de asignación por Administración'}</p>
      <p className="text-sm text-gray-500">Este documento se comparte entre todas las materias del docente de este año.</p>
    </header>
    {p.conflictoMigracion && <p className="text-warning">Administración debe resolver las copias anteriores. El formulario y la presentación están bloqueados.</p>}
    <PaadControls key={p.id + ':' + (revision?.id ?? '') + ':' + (p.fuenteLegacyId ?? '')} paadId={p.id} presentacionId={revision?.id}
      canReview={revisable && !revision?.dictamenes.some(d => d.rolAutor === actor.rol)}
      canAssign={actor.rol === 'ADMINISTRADOR' && p.estado === 'BORRADOR' && !p.presentaciones.length}
      carreraId={p.carreraEvaluadoraId} carreras={carreras}
      fuentes={actor.rol === 'ADMINISTRADOR' && p.conflictoMigracion ? copias.map(c => ({ id: c.id,
        nombre: c.planificacion.asignatura.nombre + ' · ' + c.updatedAt.toLocaleDateString('es-AR') + ' · ' + c.estadoPresento })) : []} />
    <ViewToggle form={<PaadForm key={p.id + ':' + (revision?.numero ?? 0) + ':' + (p.fuenteLegacyId ?? '')} paadId={p.id} presentacionId={revision?.id}
      canPresent={editable && !!p.carreraEvaluadoraId && !p.observaciones.some(o => !o.resuelto)}
      docenteNombre={nombre} cargoEnCatedra="Documento personal anual"
      estadoPresento={p.presentaciones.length ? 'PRESENTO' : 'NO_PRESENTO'}
      data={p.datosPaad as unknown as PaadData} editable={editable} canObserve={revisable}
      canResolve={propio && !p.conflictoMigracion && p.estado === 'OBSERVADO'} observaciones={p.observaciones} />}
      document={<PaadDocumentView data={p.datosPaad as unknown as PaadData} docenteNombre={nombre} cargo={'Ciclo ' + p.cicloLectivo} />} />
    <section className="space-y-2"><h2 className="text-lg">Historial de observaciones del PAAD</h2>
      {p.observaciones.map(o => <div key={o.id} className="border border-border rounded-lg p-3">
        <p className="text-xs text-gray-500">{o.rolAutor} · {o.autor.nombre} {o.autor.apellido} · {o.createdAt.toLocaleString('es-AR')} · {o.campoPath}</p>
        <ObservationFieldWrapper paadAnualId={p.id} presentacionId={revision?.id} documentoTipo="PAAD" fieldPath={o.campoPath}
          observaciones={[o]} canResolve={propio && p.estado === 'OBSERVADO' && !p.conflictoMigracion}>
          <p>{o.resuelto ? 'Resuelto: ' + o.mensaje : 'Pendiente'}</p>
        </ObservationFieldWrapper>
      </div>)}
      {!p.observaciones.length && <p className="text-gray-500">Sin observaciones.</p>}
    </section>
    <section className="space-y-3"><h2 className="text-lg">Presentaciones y dictámenes</h2>
      {p.presentaciones.map(r => <details key={r.id} className="border border-border rounded-lg p-3">
        <summary>Presentación {r.numero} · {r.createdAt.toLocaleString('es-AR')}</summary>
        <p className="text-sm my-2">{r.autor ? 'Presentada por ' + r.autor.nombre + ' ' + r.autor.apellido + ' · ' + r.rolAutor : 'Presentación importada: autor de presentación no registrado en el sistema anterior.'}</p>
        {r.dictamenes.map(d => <p key={d.id} className="text-sm my-2">{d.rolAutor} · {d.autor.nombre} {d.autor.apellido} · {d.createdAt.toLocaleString('es-AR')} · {d.resultado}: {d.comentario}</p>)}
        <PaadDocumentView data={r.datosPaad as unknown as PaadData} docenteNombre={nombre} cargo={'Presentación ' + r.numero} />
      </details>)}
    </section>
    {copias.length > 0 && <section><h2 className="text-lg mb-3">Antecedentes por materia (solo lectura)</h2>
      {copias.map(c => <details key={c.id} className="border border-border rounded-lg p-3 mb-2">
        <summary>{c.planificacion.asignatura.nombre} · {c.estadoPresento} {p.fuenteLegacyId === c.id ? '· Fuente elegida' : ''}</summary>
        <PaadDocumentView data={c.datosPaad as unknown as PaadData} docenteNombre={nombre} cargo={c.cargoEnCatedra} />
        {obsLegacy.filter(o => o.docentePaadId === c.id || (o.docentePaadId === null && o.planificacionId === c.planificacionId)).map(o =>
          <p key={o.id} className="text-sm">{o.rolAutor} · {o.createdAt.toLocaleString('es-AR')} · {o.mensaje} · {o.resuelto ? 'Resuelto' : 'Pendiente en la copia antigua'}</p>)}
      </details>)}
    </section>}
  </div>;
}
