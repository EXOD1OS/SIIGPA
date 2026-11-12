'use client';

import { Modal, ModalButton } from '@/components/shared/Modal';
import type { AsignacionAdmin, AsignaturaAdmin, CarreraAdmin, PlanAdmin } from './tipos';

interface Props {
  carrera: CarreraAdmin;
  sede: string;
  departamento: string;
  planes: PlanAdmin[];
  asignaturas: AsignaturaAdmin[];
  equipoDeAsig: (asigId: string) => AsignacionAdmin[];
  departamentoNombre: (id: string) => string | undefined;
  ciclo: number;
  onGestionarEquipo: (asigId: string) => void;
  onClose: () => void;
}

/** Detalle de una carrera: datos institucionales, planes y cobertura de equipos del ciclo. */
export function CarreraDetalleModal({ carrera, sede, departamento, planes, asignaturas, equipoDeAsig, departamentoNombre, ciclo, onGestionarEquipo, onClose }: Props) {
  const conResponsable = asignaturas.filter((a) => equipoDeAsig(a.id).some((e) => e.esResponsable)).length;
  const datos: [string, string][] = [
    ['Código', carrera.codigo],
    ['Sede', sede],
    ['Departamento', departamento],
    ['Dirección de carrera', carrera.director ?? 'Sin Dirección asignada'],
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={carrera.nombre}
      widthClass="max-w-2xl"
      headerExtra={
        <p className="text-xs text-muted">
          {planes.length} plan(es) · {asignaturas.length} asignatura(s) · {conResponsable}/{asignaturas.length} con responsable en {ciclo}
        </p>
      }
      footer={<ModalButton onClick={onClose}>Cerrar</ModalButton>}
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {datos.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-background px-3 py-2">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{k}</dt>
              <dd className="mt-0.5 text-xs text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        {planes.map((plan) => {
          const asigs = asignaturas.filter((a) => a.planId === plan.id).sort((a, b) => a.anoCursada - b.anoCursada);
          return (
            <section key={plan.id} className="space-y-2">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-ink">
                {plan.ordenanza}
                <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                  {plan.enfoque === 'COMPETENCIAS' ? 'Competencias' : 'Tradicional'}
                </span>
              </h3>
              <div className="space-y-2">
                {asigs.map((a) => {
                  const eq = equipoDeAsig(a.id);
                  const resp = eq.some((e) => e.esResponsable);
                  const esMatricial = a.departamentoRadicacionId !== carrera.departamentoId;
                  return (
                    <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2">
                      <span className="min-w-[10rem] flex-1 truncate text-sm text-ink">
                        {a.anoCursada}.º · {a.nombre}
                        <span className="block truncate text-[11px] text-muted">
                          {a.regimen} · {a.creditoHorario} hs
                          {esMatricial && ` · Radicada en ${departamentoNombre(a.departamentoRadicacionId) ?? 'otro departamento'}`}
                        </span>
                      </span>
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                          resp ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {resp ? `${eq.length} docente(s)` : 'Sin responsable'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onGestionarEquipo(a.id)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary hover:text-primary-hover"
                      >
                        Gestionar equipo
                      </button>
                    </div>
                  );
                })}
                {asigs.length === 0 && <p className="text-xs text-muted">Sin asignaturas cargadas en este plan.</p>}
              </div>
            </section>
          );
        })}
        {planes.length === 0 && <p className="text-xs text-muted">La carrera no tiene planes de estudio cargados.</p>}
      </div>
    </Modal>
  );
}
