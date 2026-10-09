'use client';

import { useState, useTransition } from 'react';
import { guardarBorradorPaad, presentarPaad } from '@/actions/paad.actions';
import { useRouter } from 'next/navigation';
import { ObservationFieldWrapper } from '@/components/ObservationFieldWrapper';
import { TextField, TextAreaField, ListField, RepeatableList, SectionCard } from './fields';
import type { PaadData } from '@/types/planificacion';

interface Observacion {
  id: string;
  campoPath: string;
  mensaje: string;
  rolAutor: string;
  resuelto: boolean;
}

interface Props {
  presentacionId?: string;
  canPresent: boolean;
  paadId: string;
  docenteNombre: string;
  cargoEnCatedra: string;
  estadoPresento: string;
  data: PaadData;
  editable: boolean;
  canObserve: boolean;
  canResolve: boolean;
  observaciones: Observacion[];
}

function obsFor(observaciones: Observacion[], paadId: string, path: string) {
  return observaciones.filter((o) => o.campoPath === path);
}

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const;
const DIA_LABELS: Record<(typeof DIAS)[number], string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
};
const ACTIVIDAD_LABELS: Record<string, string> = {
  ENSENANZA: 'Enseñanza',
  INVESTIGACION: 'Investigación',
  EXTENSION: 'Extensión',
  FORMACION: 'Formación',
  GESTION: 'Gestión',
};

export function PaadForm({
  presentacionId,
  canPresent,
  paadId,
  docenteNombre,
  cargoEnCatedra,
  estadoPresento,
  data,
  editable,
  canObserve,
  canResolve,
  observaciones,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState<PaadData>(data);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function update(updater: (draft: PaadData) => void) {
    setForm((prev) => {
      const draft = structuredClone(prev);
      updater(draft);
      return draft;
    });
    setSaved(false);
    setDirty(true);
  }

  function handleSave() {
    startTransition(async () => {
      setError(null);
      try { await guardarBorradorPaad(paadId, form); setSaved(true); setDirty(false); router.refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    });
  }

  const wrap = (path: string, node: React.ReactNode) => (
    <ObservationFieldWrapper
      paadAnualId={paadId}
      presentacionId={presentacionId}
      documentoTipo="PAAD"
      fieldPath={path}
      observaciones={obsFor(observaciones, paadId, path)}
      canObserve={canObserve}
      canResolve={canResolve}
    >
      {node}
    </ObservationFieldWrapper>
  );

  return (
    <SectionCard title={`PAAD — ${docenteNombre} (${cargoEnCatedra})`}>
      <div className="flex items-center gap-2 -mt-2 mb-2">
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${
            estadoPresento === 'PRESENTO'
              ? 'bg-success/15 text-emerald-300 border-success/40'
              : 'bg-gray-500/15 text-gray-400 border-gray-500/40'
          }`}
        >
          {estadoPresento === 'PRESENTO' ? 'Presentado' : 'Pendiente de presentar'}
        </span>
      </div>

      <div className="space-y-3 border border-border rounded-lg p-3">
        <p className="text-xs font-medium text-gray-400">1) Actividad de Enseñanza</p>
        {wrap(
          'actividadEnsenanza.cursosAtendidos',
          <ListField
            label="Cursos y/o asignaturas atendidos"
            value={form.actividadEnsenanza.cursosAtendidos}
            disabled={!editable}
            onChange={(v) => update((d) => (d.actividadEnsenanza.cursosAtendidos = v))}
          />
        )}
        <RepeatableList
          label="Capacitaciones en las que participará"
          items={form.actividadEnsenanza.capacitaciones}
          disabled={!editable}
          newItem={() => ({ lugar: '', fecha: '', tematica: '', areaConocimiento: '', nombreCapacitacion: '' })}
          onChange={(items) => update((d) => (d.actividadEnsenanza.capacitaciones = items))}
          renderItem={(item, patch) => (
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Nombre" value={item.nombreCapacitacion} disabled={!editable} onChange={(v) => patch({ nombreCapacitacion: v })} />
              <TextField label="Temática" value={item.tematica} disabled={!editable} onChange={(v) => patch({ tematica: v })} />
              <TextField label="Área de conocimiento" value={item.areaConocimiento} disabled={!editable} onChange={(v) => patch({ areaConocimiento: v })} />
              <TextField label="Lugar" value={item.lugar} disabled={!editable} onChange={(v) => patch({ lugar: v })} />
              <TextField label="Fecha" value={item.fecha} disabled={!editable} onChange={(v) => patch({ fecha: v })} />
            </div>
          )}
        />
        <RepeatableList
          label="Manuales, guías de TP y programas elaborados"
          items={form.actividadEnsenanza.materialElaborado}
          disabled={!editable}
          newItem={() => ({ areaConocimiento: '', tipo: '', autores: '', fecha: '' })}
          onChange={(items) => update((d) => (d.actividadEnsenanza.materialElaborado = items))}
          renderItem={(item, patch) => (
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Área de conocimiento" value={item.areaConocimiento} disabled={!editable} onChange={(v) => patch({ areaConocimiento: v })} />
              <TextField label="Tipo" value={item.tipo} disabled={!editable} onChange={(v) => patch({ tipo: v })} />
              <TextField label="Autores" value={item.autores} disabled={!editable} onChange={(v) => patch({ autores: v })} />
              <TextField label="Fecha" value={item.fecha} disabled={!editable} onChange={(v) => patch({ fecha: v })} />
            </div>
          )}
        />
        <RepeatableList
          label="Otros trabajos de índole docente"
          items={form.actividadEnsenanza.otrosTrabajosDocentes}
          disabled={!editable}
          newItem={() => ({ areaTematica: '', lugar: '', fecha: '', destinatarios: '', nivel: '' })}
          onChange={(items) => update((d) => (d.actividadEnsenanza.otrosTrabajosDocentes = items))}
          renderItem={(item, patch) => (
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Área temática" value={item.areaTematica} disabled={!editable} onChange={(v) => patch({ areaTematica: v })} />
              <TextField label="Lugar" value={item.lugar} disabled={!editable} onChange={(v) => patch({ lugar: v })} />
              <TextField label="Fecha" value={item.fecha} disabled={!editable} onChange={(v) => patch({ fecha: v })} />
              <TextField label="Destinatarios" value={item.destinatarios} disabled={!editable} onChange={(v) => patch({ destinatarios: v })} />
              <TextField label="Nivel" value={item.nivel} disabled={!editable} onChange={(v) => patch({ nivel: v })} />
            </div>
          )}
        />
      </div>

      <div className="space-y-3 border border-border rounded-lg p-3">
        <p className="text-xs font-medium text-gray-400">2) Actividades de Investigación</p>
        <RepeatableList
          label="Proyectos de investigación"
          items={form.investigacion}
          disabled={!editable}
          newItem={() => ({ proyecto: '', descripcion: '', cargo: '', numeroResolucion: '', etapa: '' })}
          onChange={(items) => update((d) => (d.investigacion = items))}
          renderItem={(item, patch) => (
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Proyecto" value={item.proyecto} disabled={!editable} onChange={(v) => patch({ proyecto: v })} />
              <TextField label="Cargo que ocupa" value={item.cargo} disabled={!editable} onChange={(v) => patch({ cargo: v })} />
              <TextField label="N° de resolución" value={item.numeroResolucion} disabled={!editable} onChange={(v) => patch({ numeroResolucion: v })} />
              <TextField label="Etapa" value={item.etapa} disabled={!editable} onChange={(v) => patch({ etapa: v })} />
              <div className="col-span-2">
                <TextAreaField label="Descripción" rows={2} value={item.descripcion} disabled={!editable} onChange={(v) => patch({ descripcion: v })} />
              </div>
            </div>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {wrap(
          'formacionRecursosHumanos.detalle',
          <TextAreaField
            label="3) Formación de Recursos Humanos (ayudantes, adscriptos, JTP a cargo)"
            rows={3}
            value={form.formacionRecursosHumanos.detalle}
            disabled={!editable}
            onChange={(v) => update((d) => (d.formacionRecursosHumanos.detalle = v))}
          />
        )}
        {wrap(
          'formacionAcademica.detalle',
          <TextAreaField
            label="4) Formación Académica y/o Especialización Profesional"
            rows={3}
            value={form.formacionAcademica.detalle}
            disabled={!editable}
            onChange={(v) => update((d) => (d.formacionAcademica.detalle = v))}
          />
        )}
      </div>

      <div className="space-y-3 border border-border rounded-lg p-3">
        <p className="text-xs font-medium text-gray-400">5) Actividades de Extensión</p>
        <RepeatableList
          label="Proyectos de extensión"
          items={form.extension}
          disabled={!editable}
          newItem={() => ({ proyecto: '', destinatarios: '', tiempoLugar: '', alumnosInvolucrados: '', informe: '' })}
          onChange={(items) => update((d) => (d.extension = items))}
          renderItem={(item, patch) => (
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Proyecto" value={item.proyecto} disabled={!editable} onChange={(v) => patch({ proyecto: v })} />
              <TextField label="Destinatarios" value={item.destinatarios} disabled={!editable} onChange={(v) => patch({ destinatarios: v })} />
              <TextField label="Tiempo y lugar" value={item.tiempoLugar} disabled={!editable} onChange={(v) => patch({ tiempoLugar: v })} />
              <TextField label="Alumnos involucrados" value={item.alumnosInvolucrados} disabled={!editable} onChange={(v) => patch({ alumnosInvolucrados: v })} />
              <div className="col-span-2">
                <TextAreaField label="Informe de finalización" rows={2} value={item.informe} disabled={!editable} onChange={(v) => patch({ informe: v })} />
              </div>
            </div>
          )}
        />
      </div>

      {wrap(
        'gestion.detalle',
        <TextAreaField
          label="6) Actividades de Administración y Gobierno Universitario"
          rows={3}
          value={form.gestion.detalle}
          disabled={!editable}
          onChange={(v) => update((d) => (d.gestion.detalle = v))}
        />
      )}

      {wrap(
        'otrasActividades',
        <ListField
          label="7) Otras actividades no previstas"
          value={form.otrasActividades}
          disabled={!editable}
          onChange={(v) => update((d) => (d.otrasActividades = v))}
        />
      )}

      <div>
        <p className="text-xs text-gray-500 mb-2">8) Distribución horaria semanal de sus actividades</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left py-1 pr-2">Actividad</th>
                {DIAS.map((dia) => (
                  <th key={dia} className="text-left py-1 px-1">
                    {DIA_LABELS[dia]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.distribucionHoraria.map((fila, idx) => (
                <tr key={fila.actividad} className="border-t border-border">
                  <td className="py-1 pr-2 text-gray-300">{ACTIVIDAD_LABELS[fila.actividad] ?? fila.actividad}</td>
                  {DIAS.map((dia) => (
                    <td key={dia} className="py-1 px-1">
                      <input
                        className="w-16 text-xs"
                        value={(fila as any)[dia] ?? ''}
                        disabled={!editable}
                        onChange={(e) =>
                          update((d) => {
                            (d.distribucionHoraria[idx] as any)[dia] = e.target.value;
                          })
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editable && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={handleSave}
            className="bg-primary hover:bg-primary-hover transition-colors text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {pending ? 'Guardando...' : 'Guardar borrador PAAD'}
          </button>
          {canPresent && <button type="button" disabled={pending || dirty} className="bg-success/80 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            onClick={() => startTransition(async () => {
              setError(null);
              try { await presentarPaad(paadId); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo presentar.'); }
            })}>Presentar PAAD</button>}
          {dirty && <span className="text-xs text-gray-400">Guardá los cambios antes de presentar.</span>}
          {saved && !pending && <span className="text-xs text-success">Guardado.</span>}
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </SectionCard>
  );
}
