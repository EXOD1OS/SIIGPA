'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, ModalButton } from '@/components/shared/Modal';
import { guardarEquipoCatedra } from '@/actions/admin.actions';
import { ESTADO_LABELS } from '@/types/planificacion';
import { CARGOS_CATEDRA, CARGO_LABEL, type AsignacionAdmin, type AsignaturaAdmin, type DocenteAdmin } from './tipos';

interface Borrador {
  docenteId: string;
  categoria: string;
  esResponsable: boolean;
}

interface Props {
  asignatura: AsignaturaAdmin;
  /** "Sede · LSI · Ord. 171/2019 (TRADICIONAL)". */
  contexto: string[];
  /** Nombre del departamento de radicación cuando difiere del de la carrera (matricial). */
  radicacionMatricial: string | null;
  ciclo: number;
  equipo: AsignacionAdmin[];
  docentes: DocenteAdmin[];
  /** Estado de la planificación del ciclo (si existe): fuera de Borrador/Observado el equipo es de solo lectura. */
  estadoPlanif: string | null;
  onClose: () => void;
}

const fieldCls = 'w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary disabled:opacity-50';
const thCls = 'px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted';

/**
 * Conformación del equipo de cátedra de una asignatura en un ciclo. Columnas: Docente, Cargo en Cátedra,
 * Responsabilidad PAAC y Acciones (sin "Estado PAAD": el PAAD es personal y se sigue desde su bandeja).
 */
export function EquipoCatedraModal({ asignatura, contexto, radicacionMatricial, ciclo, equipo, docentes, estadoPlanif, onClose }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [inicial] = useState<Borrador[]>(() =>
    [...equipo].sort((a, b) => Number(b.esResponsable) - Number(a.esResponsable)).map(({ docenteId, categoria, esResponsable }) => ({ docenteId, categoria, esResponsable })),
  );
  const [integrantes, setIntegrantes] = useState<Borrador[]>(inicial);
  const [nuevoDocenteId, setNuevoDocenteId] = useState('');
  const [nuevoCargo, setNuevoCargo] = useState<string>('AYUDANTE');
  const [error, setError] = useState<string | null>(null);

  const bloqueado = !!estadoPlanif && !['BORRADOR', 'OBSERVADO'].includes(estadoPlanif);
  const docenteBy = useMemo(() => new Map(docentes.map((d) => [d.id, d])), [docentes]);
  const disponibles = docentes.filter((d) => !integrantes.some((i) => i.docenteId === d.id));
  const docenteSeleccionado = disponibles.some((d) => d.id === nuevoDocenteId) ? nuevoDocenteId : (disponibles[0]?.id ?? '');
  const dirty = JSON.stringify(integrantes) !== JSON.stringify(inicial);

  const nombreDocente = (id: string) => {
    const u = docenteBy.get(id);
    return u ? `${u.apellido}, ${u.nombre}` : 'Docente';
  };
  const actualizar = (docenteId: string, cambios: Partial<Borrador>) =>
    setIntegrantes((prev) => prev.map((i) => (i.docenteId === docenteId ? { ...i, ...cambios } : i)));

  const agregar = () => {
    if (!docenteSeleccionado) return;
    setError(null);
    // El primer integrante queda como responsable por defecto.
    setIntegrantes((prev) => [...prev, { docenteId: docenteSeleccionado, categoria: nuevoCargo, esResponsable: prev.length === 0 }]);
    setNuevoDocenteId('');
  };

  const guardar = () => {
    if (integrantes.length > 0 && !integrantes.some((i) => i.esResponsable)) {
      setError('Designá un Docente Responsable antes de guardar.');
      return;
    }
    setError(null);
    start(async () => {
      try {
        await guardarEquipoCatedra(asignatura.id, ciclo, integrantes);
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo guardar el equipo.');
      }
    });
  };

  return (
    <Modal
      open
      onClose={pending ? () => undefined : onClose}
      title="Gestión de equipo de cátedra"
      widthClass="max-w-3xl"
      headerExtra={
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-ink">
            {asignatura.nombre}{' '}
            <span className="font-normal text-muted">
              · {asignatura.anoCursada}.º año · {asignatura.regimen} · {asignatura.creditoHorario} hs
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {contexto.map((c, i) => (
              <span key={c} className={`rounded border px-2 py-0.5 text-[10px] font-bold ${i === 0 ? 'border-primary bg-soft text-primary' : 'border-border bg-background text-ink'}`}>
                {c}
              </span>
            ))}
            {radicacionMatricial && (
              <span className="rounded border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                Radicación matricial: {radicacionMatricial}
              </span>
            )}
          </div>
        </div>
      }
      footer={
        <>
          {dirty && <span className="mr-auto text-[11px] font-medium text-warning">Hay cambios sin guardar</span>}
          <ModalButton onClick={onClose} disabled={pending}>
            Cerrar
          </ModalButton>
          {!bloqueado && (
            <ModalButton variant="primary" onClick={guardar} disabled={!dirty || pending}>
              {pending ? 'Guardando…' : 'Guardar cambios'}
            </ModalButton>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-muted">
          Ciclo lectivo {ciclo}. Los cambios se aplican al presionar <strong className="text-ink">Guardar cambios</strong>.
          {radicacionMatricial && ' La planificación de esta asignatura se deriva al departamento de radicación.'}
        </p>
        {bloqueado && (
          <p role="note" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            La planificación del ciclo está «{ESTADO_LABELS[estadoPlanif ?? ''] ?? estadoPlanif}»: el equipo no puede modificarse.
          </p>
        )}

        <div className="rounded-lg border border-border bg-background px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Contenidos mínimos</div>
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ink">{asignatura.contenidosMinimos || 'Sin contenidos mínimos cargados.'}</p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] table-fixed border-collapse text-xs">
            <thead className="bg-background">
              <tr>
                <th scope="col" className={`${thCls} w-[40%]`}>
                  Docente
                </th>
                <th scope="col" className={`${thCls} w-[28%]`}>
                  Cargo en Cátedra
                </th>
                <th scope="col" className={`${thCls} w-[18%]`}>
                  Responsabilidad PAAC
                </th>
                <th scope="col" className={`${thCls} w-[14%] text-right`}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {integrantes.map((m) => (
                <tr key={m.docenteId}>
                  <td className="min-w-0 px-3 py-2">
                    <span className="block truncate text-sm text-ink">{nombreDocente(m.docenteId)}</span>
                    <span className="block truncate text-[11px] text-muted">{docenteBy.get(m.docenteId)?.email}</span>
                  </td>
                  <td className="px-3 py-2">
                    <label className="sr-only" htmlFor={`cargo-${m.docenteId}`}>
                      Cargo de {nombreDocente(m.docenteId)}
                    </label>
                    <select
                      id={`cargo-${m.docenteId}`}
                      value={m.categoria}
                      disabled={bloqueado}
                      onChange={(e) => actualizar(m.docenteId, { categoria: e.target.value })}
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-primary disabled:opacity-60"
                    >
                      {CARGOS_CATEDRA.map((c) => (
                        <option key={c} value={c}>
                          {CARGO_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink">
                      <input
                        type="radio"
                        name={`responsable-${asignatura.id}`}
                        checked={m.esResponsable}
                        disabled={bloqueado}
                        onChange={() => {
                          setError(null);
                          setIntegrantes((prev) => prev.map((i) => ({ ...i, esResponsable: i.docenteId === m.docenteId })));
                        }}
                        className="accent-primary"
                      />
                      {m.esResponsable ? <span className="font-semibold text-primary">Responsable</span> : <span className="text-muted">Integrante</span>}
                    </label>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={m.esResponsable || bloqueado}
                      onClick={() => setIntegrantes((prev) => prev.filter((i) => i.docenteId !== m.docenteId))}
                      className="whitespace-nowrap text-xs text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:no-underline"
                      title={m.esResponsable ? 'Cambiá el responsable antes de quitarlo' : undefined}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
              {integrantes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-xs text-muted">
                    Sin integrantes cargados para el ciclo {ciclo}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!bloqueado &&
          (disponibles.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="nuevo-docente" className="mb-1 block text-[11px] text-muted">
                  Docente
                </label>
                <select id="nuevo-docente" value={docenteSeleccionado} onChange={(e) => setNuevoDocenteId(e.target.value)} className={fieldCls}>
                  {disponibles.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.apellido}, {d.nombre} (DNI {d.dni})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:w-56">
                <label htmlFor="nuevo-cargo" className="mb-1 block text-[11px] text-muted">
                  Cargo en Cátedra
                </label>
                <select id="nuevo-cargo" value={nuevoCargo} onChange={(e) => setNuevoCargo(e.target.value)} className={fieldCls}>
                  {CARGOS_CATEDRA.map((c) => (
                    <option key={c} value={c}>
                      {CARGO_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={agregar}
                className="rounded-lg bg-primary px-3 py-2 text-xs text-white hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                + Agregar
              </button>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted">Todos los docentes ya integran esta cátedra.</p>
          ))}
      </div>
    </Modal>
  );
}
