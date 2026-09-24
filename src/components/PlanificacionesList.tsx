'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { UserRole } from '@prisma/client';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { setSelectedCycle } from '@/redux/slices/planificationSlice';
import { StatusBadge } from '@/components/StatusBadge';
import { ResolucionModal } from '@/components/ResolucionModal';
import { ESTADO_LABELS } from '@/types/planificacion';

interface PlanifRow {
  id: string;
  estado: string;
  cicloLectivo: number;
  regimen: string;
  numeroExpediente: string | null;
  numeroResolucion: string | null;
  fechaAprobacionCd: string | null;
  asignatura: { nombre: string; planEstudio: { carrera: { nombre: string; codigo: string; sede: { nombre: string } } } };
  docenteResponsable: { nombre: string; apellido: string };
}

const TODOS = '__todos__';

function periodoDe(regimen: string): '1C' | '2C' {
  return regimen === '2C' ? '2C' : '1C';
}

export function PlanificacionesList({ planificaciones, rol }: { planificaciones: PlanifRow[]; rol: UserRole }) {
  const dispatch = useAppDispatch();
  const selectedCycle = useAppSelector((s) => s.planification.selectedCycle);
  const [sede, setSede] = useState(TODOS);
  const [periodo, setPeriodo] = useState(TODOS);
  const [carrera, setCarrera] = useState(TODOS);
  const [estado, setEstado] = useState(TODOS);

  const ciclos = Array.from(new Set(planificaciones.map((p) => p.cicloLectivo))).sort((a, b) => b - a);
  const sedes = Array.from(new Set(planificaciones.map((p) => p.asignatura.planEstudio.carrera.sede.nombre))).sort();
  const carreras = useMemo(
    () =>
      Array.from(
        new Set(
          planificaciones
            .filter((p) => sede === TODOS || p.asignatura.planEstudio.carrera.sede.nombre === sede)
            .map((p) => p.asignatura.planEstudio.carrera.nombre)
        )
      ).sort(),
    [planificaciones, sede]
  );
  const estados = Array.from(new Set(planificaciones.map((p) => p.estado)));

  function onSedeChange(v: string) {
    setSede(v);
    setCarrera(TODOS);
  }

  const visibles = useMemo(() => {
    const mostrarTodosCiclos = selectedCycle === 0;
    return planificaciones.filter(
      (p) =>
        (mostrarTodosCiclos || p.cicloLectivo === selectedCycle) &&
        (sede === TODOS || p.asignatura.planEstudio.carrera.sede.nombre === sede) &&
        (periodo === TODOS || periodoDe(p.regimen) === periodo) &&
        (carrera === TODOS || p.asignatura.planEstudio.carrera.nombre === carrera) &&
        (estado === TODOS || p.estado === estado)
    );
  }, [planificaciones, selectedCycle, sede, periodo, carrera, estado]);

  const esDocente = rol === UserRole.DOCENTE;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Ciclo lectivo</label>
          <select value={selectedCycle} onChange={(e) => dispatch(setSelectedCycle(Number(e.target.value)))}>
            <option value={0}>Todos (histórico)</option>
            {ciclos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Sede</label>
          <select value={sede} onChange={(e) => onSedeChange(e.target.value)}>
            <option value={TODOS}>Todas</option>
            {sedes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Período</label>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value={TODOS}>Todos</option>
            <option value="1C">1er Cuatrimestre (Anual + 1C)</option>
            <option value="2C">2do Cuatrimestre</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Carrera</label>
          <select value={carrera} onChange={(e) => setCarrera(e.target.value)}>
            <option value={TODOS}>Todas</option>
            {carreras.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value={TODOS}>Todos</option>
            {estados.map((e) => (
              <option key={e} value={e}>
                {ESTADO_LABELS[e] ?? e}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-2">{visibles.length} planificación(es)</p>

      <div className="border border-border rounded-xl overflow-hidden bg-surface divide-y divide-border">
        <div className="grid grid-cols-12 px-5 py-3 text-xs text-gray-500 uppercase tracking-wide">
          <span className="col-span-4">Asignatura</span>
          <span className="col-span-2">Carrera</span>
          <span className="col-span-1">Ciclo</span>
          <span className="col-span-2">Responsable</span>
          <span className="col-span-2">Estado</span>
          <span className="col-span-1">{esDocente ? 'Expediente' : ''}</span>
        </div>
        {visibles.map((p) => (
          <div key={p.id} className="grid grid-cols-12 items-center px-5 py-4 hover:bg-background/50 transition-colors text-sm">
            <Link href={`/planificaciones/${p.id}`} className="col-span-4 text-gray-200">
              {p.asignatura.nombre}
            </Link>
            <Link href={`/planificaciones/${p.id}`} className="col-span-2 text-gray-400">
              {p.asignatura.planEstudio.carrera.codigo}
            </Link>
            <Link href={`/planificaciones/${p.id}`} className="col-span-1 text-gray-400">
              {p.cicloLectivo}
            </Link>
            <Link href={`/planificaciones/${p.id}`} className="col-span-2 text-gray-400 truncate">
              {p.docenteResponsable.nombre} {p.docenteResponsable.apellido}
            </Link>
            <Link href={`/planificaciones/${p.id}`} className="col-span-2">
              <StatusBadge estado={p.estado} />
            </Link>
            <span className="col-span-1">
              {esDocente && (
                <ResolucionModal
                  asignatura={p.asignatura.nombre}
                  cicloLectivo={p.cicloLectivo}
                  numeroExpediente={p.numeroExpediente}
                  numeroResolucion={p.numeroResolucion}
                  fechaAprobacionCd={p.fechaAprobacionCd}
                />
              )}
            </span>
          </div>
        ))}
        {visibles.length === 0 && <p className="px-5 py-6 text-sm text-gray-500">No hay planificaciones para mostrar.</p>}
      </div>
    </div>
  );
}
