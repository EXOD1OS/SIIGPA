'use client';

import { useEffect, useMemo, useState } from 'react';
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
const TAMANO_PAGINA = 10;

function periodoDe(regimen: string): '1C' | '2C' {
  return regimen === '2C' ? '2C' : '1C';
}

export function PlanificacionesList({ planificaciones, rol, initialEstado }: { planificaciones: PlanifRow[]; rol: UserRole; initialEstado?: string }) {
  const dispatch = useAppDispatch();
  const selectedCycle = useAppSelector((s) => s.planification.selectedCycle);
  const [sede, setSede] = useState(TODOS);
  const [periodo, setPeriodo] = useState(TODOS);
  const [carrera, setCarrera] = useState(TODOS);
  const [estado, setEstado] = useState(initialEstado || TODOS);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);

  const ciclos = Array.from(new Set([new Date().getFullYear(), ...planificaciones.map((p) => p.cicloLectivo)])).sort(
    (a, b) => b - a
  );
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
  const estados = Array.from(new Set([...planificaciones.map((p) => p.estado), ...(initialEstado ? [initialEstado] : [])]));

  useEffect(() => {
    setPagina(1);
  }, [selectedCycle, sede, periodo, carrera, estado, busqueda]);

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
        (estado === TODOS || p.estado === estado) &&
        (!busqueda.trim() || `${p.asignatura.nombre} ${p.docenteResponsable.nombre} ${p.docenteResponsable.apellido}`.toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es')))
    );
  }, [planificaciones, selectedCycle, sede, periodo, carrera, estado, busqueda]);

  const esDocente = rol === UserRole.DOCENTE;
  const columnasTabla = esDocente ? 'grid-cols-6' : 'grid-cols-5';
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / TAMANO_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const filasPagina = visibles.slice((paginaActual - 1) * TAMANO_PAGINA, paginaActual * TAMANO_PAGINA);

  function limpiarFiltros() {
    dispatch(setSelectedCycle(new Date().getFullYear()));
    setSede(TODOS);
    setPeriodo(TODOS);
    setCarrera(TODOS);
    setEstado(TODOS);
    setBusqueda('');
    setPagina(1);
  }

  return (
    <div className="space-y-3">
      <section aria-label="Filtros de planificaciones" className="rounded-xl border border-blue-100/10 bg-gradient-to-br from-[#12233e] to-[#0b172b] p-4 shadow-lg shadow-blue-950/20 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="buscar-planificaciones" className="mb-1.5 block text-xs font-medium text-slate-400">Buscar asignatura o responsable</label>
          <div className="relative">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
            <input id="buscar-planificaciones" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej.: Álgebra o Claudia Santander" className="w-full rounded-lg border border-blue-100/10 bg-[#09172b] py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-400/10" />
          </div>
        </div>
        <button type="button" onClick={limpiarFiltros} className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-blue-200/15 bg-blue-400/[0.06] px-4 py-2 text-sm font-medium text-blue-100 transition hover:border-blue-200/30 hover:bg-blue-400/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          <span aria-hidden="true">↺</span> Limpiar filtros
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Ciclo lectivo</label>
          <select className="w-full rounded-lg border border-blue-100/10 bg-[#09172b] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-blue-300/40 focus:ring-2 focus:ring-blue-400/10" value={selectedCycle} onChange={(e) => dispatch(setSelectedCycle(Number(e.target.value)))}>
            <option value={0}>Todos (histórico)</option>
            {ciclos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Sede</label>
          <select className="w-full rounded-lg border border-blue-100/10 bg-[#09172b] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-blue-300/40 focus:ring-2 focus:ring-blue-400/10" value={sede} onChange={(e) => onSedeChange(e.target.value)}>
            <option value={TODOS}>Todas</option>
            {sedes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Período</label>
          <select className="w-full rounded-lg border border-blue-100/10 bg-[#09172b] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-blue-300/40 focus:ring-2 focus:ring-blue-400/10" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value={TODOS}>Todos</option>
            <option value="1C">1er Cuatrimestre (Anual + 1C)</option>
            <option value="2C">2do Cuatrimestre</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Carrera</label>
          <select className="w-full rounded-lg border border-blue-100/10 bg-[#09172b] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-blue-300/40 focus:ring-2 focus:ring-blue-400/10" value={carrera} onChange={(e) => setCarrera(e.target.value)}>
            <option value={TODOS}>Todas</option>
            {carreras.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Estado</label>
          <select className="w-full rounded-lg border border-blue-100/10 bg-[#09172b] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-blue-300/40 focus:ring-2 focus:ring-blue-400/10" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value={TODOS}>Todos</option>
            {estados.map((e) => (
              <option key={e} value={e}>
                {ESTADO_LABELS[e] ?? e}
              </option>
            ))}
          </select>
        </div>
      </div>
      </section>

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm font-medium text-slate-300">Resultados</p>
        <span className="rounded-full border border-blue-200/10 bg-blue-400/[0.07] px-3 py-1 text-xs font-medium tabular-nums text-blue-200">{visibles.length} {visibles.length === 1 ? 'planificación' : 'planificaciones'}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1b32]/90 shadow-lg shadow-blue-950/20">
        <div className={`grid ${columnasTabla} border-b border-white/[0.08] bg-white/[0.04] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400`}>
          <span className="text-center">Asignatura</span>
          <span className="text-center">Carrera</span>
          <span className="text-center">Ciclo</span>
          <span className="text-center">Responsable</span>
          <span className="text-center">Estado</span>
          {esDocente && <span className="text-center">Expediente</span>}
        </div>
        {filasPagina.map((p) => (
          <div key={p.id} className={`group grid ${columnasTabla} items-center border-b border-white/[0.06] px-5 py-4 text-sm transition-colors last:border-b-0 hover:bg-blue-400/[0.06]`}>
            <Link href={`/planificaciones/${p.id}`} className="min-w-0 px-1 text-center font-medium text-slate-200 transition-colors hover:text-white">
              <span title={p.asignatura.nombre} className="block truncate">{p.asignatura.nombre}</span>
              <span className="mt-1 block truncate text-[11px] font-normal text-slate-500">{p.asignatura.planEstudio.carrera.nombre}</span>
            </Link>
            <Link href={`/planificaciones/${p.id}`} className="min-w-0 truncate px-1 text-center text-slate-400 transition-colors hover:text-blue-200">
              {p.asignatura.planEstudio.carrera.codigo}
            </Link>
            <Link href={`/planificaciones/${p.id}`} className="text-center text-slate-400 transition-colors hover:text-blue-200">
              {p.cicloLectivo}
            </Link>
            <Link href={`/planificaciones/${p.id}`} className="min-w-0 truncate px-1 text-center text-slate-400 transition-colors hover:text-blue-200">
              {p.docenteResponsable.nombre} {p.docenteResponsable.apellido}
            </Link>
            <Link href={`/planificaciones/${p.id}`} className="flex min-w-0 items-center justify-center">
              <StatusBadge estado={p.estado} />
            </Link>
            {esDocente && (
              <span className="flex min-w-0 justify-center">
                <ResolucionModal
                  asignatura={p.asignatura.nombre}
                  cicloLectivo={p.cicloLectivo}
                  numeroExpediente={p.numeroExpediente}
                  numeroResolucion={p.numeroResolucion}
                  fechaAprobacionCd={p.fechaAprobacionCd}
                />
              </span>
            )}
          </div>
        ))}
        {visibles.length === 0 && <div className="px-5 py-12 text-center"><p className="text-sm font-medium text-slate-300">No hay planificaciones para mostrar</p><p className="mt-1 text-xs text-slate-500">Probá cambiar o quitar alguno de los filtros.</p></div>}
      </div>
      {visibles.length > 0 && (
        <nav aria-label="Paginación de planificaciones" className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#0d1b32]/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">Mostrando {(paginaActual - 1) * TAMANO_PAGINA + 1}–{Math.min(paginaActual * TAMANO_PAGINA, visibles.length)} de {visibles.length}</p>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button type="button" onClick={() => setPagina((actual) => Math.max(1, actual - 1))} disabled={paginaActual === 1} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-blue-300/25 hover:bg-blue-400/[0.08] disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
            <span aria-live="polite" className="min-w-[100px] text-center text-xs tabular-nums text-slate-400">Página {paginaActual} de {totalPaginas}</span>
            <button type="button" onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))} disabled={paginaActual === totalPaginas} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-blue-300/25 hover:bg-blue-400/[0.08] disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
          </div>
        </nav>
      )}
    </div>
  );
}
