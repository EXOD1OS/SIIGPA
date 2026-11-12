'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { TreeItem } from './TreeItem';
import { EquipoCatedraModal } from './EquipoCatedraModal';
import { CarreraDetalleModal } from './CarreraDetalleModal';
import type { AsignaturaAdmin, CarreraAdmin, EstructuraAdmin, SedeAdmin } from './tipos';

type FiltroRegimen = 'ALL' | 'ANUAL' | '1C' | '2C';

const BADGE_NEUTRO = 'border-border bg-surface text-muted';
const BADGE_PRIMARIO = 'border-primary bg-soft text-primary';
const BADGE_MATRICIAL = 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
const BADGE_OK = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
const BADGE_PENDIENTE = 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';

const rowActionCls =
  'px-2.5 py-1 rounded-lg border border-border bg-surface text-primary hover:bg-primary hover:text-white hover:border-primary text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
const selectCls = 'rounded-xl bg-surface border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary';

/**
 * Estructura académica y equipos de cátedra: árbol Sede → (Departamento) → Carrera → Plan → Asignatura.
 * Capital se organiza por departamento; las sedes regionales, directamente por carrera.
 */
export function AdminEstructuraView({ S, ciclos }: { S: EstructuraAdmin; ciclos: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCarrera, setFilterCarrera] = useState('ALL');
  const [filterRegimen, setFilterRegimen] = useState<FiltroRegimen>('ALL');
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => Object.fromEntries(S.sedes.map((s) => [s.id, true])));
  const [modalAsigId, setModalAsigId] = useState<string | null>(null);
  const [carreraDetalleId, setCarreraDetalleId] = useState<string | null>(null);
  // Si el equipo se abrió desde el detalle de una carrera, al cerrarlo se vuelve a ese detalle.
  const [origenCarreraId, setOrigenCarreraId] = useState<string | null>(null);

  const carreraBy = useMemo(() => new Map(S.carreras.map((c) => [c.id, c])), [S.carreras]);
  const planBy = useMemo(() => new Map(S.planes.map((p) => [p.id, p])), [S.planes]);
  const deptoNombre = (id: string) => S.departamentos.find((d) => d.id === id)?.nombre;
  const docenteNombre = useMemo(() => {
    const m = new Map(S.docentes.map((d) => [d.id, `${d.nombre} ${d.apellido}`]));
    return (id: string) => m.get(id) ?? 'Docente';
  }, [S.docentes]);
  const equipoDeAsig = (id: string) => S.asignaciones.filter((a) => a.asignaturaId === id);

  const toggleNode = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const expandAll = () => setExpanded(Object.fromEntries([...S.sedes, ...S.departamentos, ...S.carreras, ...S.planes].map((x) => [x.id, true])));
  const collapseAll = () => setExpanded({});
  const resetFiltros = () => {
    setSearchQuery('');
    setFilterCarrera('ALL');
    setFilterRegimen('ALL');
  };

  const isSearching = searchQuery.trim().length > 0 || filterCarrera !== 'ALL' || filterRegimen !== 'ALL';
  const isOpen = (id: string) => isSearching || !!expanded[id];

  const matchingAsigIds = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('es');
    return new Set(
      S.asignaturas
        .filter((a) => {
          const car = carreraBy.get(a.carreraId);
          if (filterCarrera !== 'ALL' && a.carreraId !== filterCarrera) return false;
          if (filterRegimen !== 'ALL' && a.regimen !== filterRegimen) return false;
          if (!q) return true;
          const docentesTxt = S.asignaciones
            .filter((e) => e.asignaturaId === a.id)
            .map((e) => docenteNombre(e.docenteId))
            .join(' ');
          return [a.nombre, car?.codigo, car?.nombre, planBy.get(a.planId)?.ordenanza, deptoNombre(car?.departamentoId ?? ''), a.regimen, docentesTxt]
            .join(' ')
            .toLocaleLowerCase('es')
            .includes(q);
        })
        .map((a) => a.id),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S, searchQuery, filterCarrera, filterRegimen]);

  const asigsDePlan = (planId: string) =>
    S.asignaturas.filter((a) => a.planId === planId && (!isSearching || matchingAsigIds.has(a.id))).sort((a, b) => a.anoCursada - b.anoCursada || a.nombre.localeCompare(b.nombre, 'es'));
  const planesDeCarrera = (carId: string) => S.planes.filter((p) => p.carreraId === carId && (!isSearching || asigsDePlan(p.id).length > 0));
  const carrerasVisibles = (list: CarreraAdmin[]) => list.filter((c) => !isSearching || planesDeCarrera(c.id).length > 0);

  const renderAsignatura = (asig: AsignaturaAdmin, car: CarreraAdmin) => {
    const eq = equipoDeAsig(asig.id);
    const resp = eq.find((x) => x.esResponsable);
    const isMat = asig.departamentoRadicacionId !== car.departamentoId;
    return (
      <TreeItem
        key={asig.id}
        label={`${asig.anoCursada}.º año · ${asig.nombre}`}
        sublabel={`Régimen: ${asig.regimen} (${asig.creditoHorario} hs) · Responsable: ${resp ? docenteNombre(resp.docenteId) : 'Sin asignar'}`}
        badge={isMat ? 'Matricial' : `${eq.length} docente(s)`}
        badgeCls={isMat ? BADGE_MATRICIAL : eq.length > 0 ? BADGE_OK : BADGE_PENDIENTE}
        active={modalAsigId === asig.id}
        onSelect={() => setModalAsigId(asig.id)}
        actions={
          <button type="button" onClick={() => setModalAsigId(asig.id)} className={rowActionCls}>
            Equipo de cátedra
          </button>
        }
      />
    );
  };

  const renderCarrera = (car: CarreraAdmin) => {
    const planes = planesDeCarrera(car.id);
    return (
      <TreeItem
        key={car.id}
        branch
        label={`${car.codigo} — ${car.nombre}`}
        badge={`${planes.length} plan(es)`}
        badgeCls={BADGE_NEUTRO}
        open={isOpen(car.id)}
        onToggle={() => toggleNode(car.id)}
        active={carreraDetalleId === car.id}
        actions={
          <button type="button" onClick={() => setCarreraDetalleId(car.id)} className={rowActionCls} aria-label={`Ver detalle de ${car.nombre}`}>
            Detalle
          </button>
        }
      >
        {planes.map((plan) => (
          <TreeItem
            key={plan.id}
            branch
            label={plan.ordenanza}
            badge={plan.enfoque === 'COMPETENCIAS' ? 'Competencias' : 'Tradicional'}
            badgeCls={BADGE_NEUTRO}
            open={isOpen(plan.id)}
            onToggle={() => toggleNode(plan.id)}
          >
            {asigsDePlan(plan.id).map((asig) => renderAsignatura(asig, car))}
          </TreeItem>
        ))}
      </TreeItem>
    );
  };

  const renderSede = (sede: SedeAdmin) => {
    const carrerasSede = S.carreras.filter((c) => c.sedeId === sede.id);
    if (isSearching && carrerasVisibles(carrerasSede).length === 0) return null;
    // Capital: Sede → Departamento → Carrera. Sedes regionales: Sede → Carrera.
    const contenido = sede.esCapital
      ? S.departamentos
          .filter((d) => carrerasSede.some((c) => c.departamentoId === d.id))
          .map((depto) => {
            const cars = carrerasVisibles(carrerasSede.filter((c) => c.departamentoId === depto.id));
            if (isSearching && cars.length === 0) return null;
            return (
              <TreeItem key={depto.id} branch label={depto.nombre} badge={`${cars.length} carrera(s)`} badgeCls={BADGE_NEUTRO} open={isOpen(depto.id)} onToggle={() => toggleNode(depto.id)}>
                {cars.map(renderCarrera)}
              </TreeItem>
            );
          })
      : carrerasVisibles(carrerasSede).map(renderCarrera);
    return (
      <TreeItem
        key={sede.id}
        branch
        label={sede.nombre}
        badge={sede.esCapital ? 'Con departamentos' : 'Sede regional (directa)'}
        badgeCls={BADGE_PRIMARIO}
        open={isOpen(sede.id)}
        onToggle={() => toggleNode(sede.id)}
      >
        {contenido}
      </TreeItem>
    );
  };

  const modalAsig = modalAsigId ? S.asignaturas.find((a) => a.id === modalAsigId) : undefined;
  const modalCar = modalAsig ? carreraBy.get(modalAsig.carreraId) : undefined;
  const modalPlan = modalAsig ? planBy.get(modalAsig.planId) : undefined;
  const carreraDetalle = carreraDetalleId ? carreraBy.get(carreraDetalleId) : undefined;

  const cerrarEquipo = () => {
    setModalAsigId(null);
    if (origenCarreraId) {
      setCarreraDetalleId(origenCarreraId);
      setOrigenCarreraId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex flex-col items-stretch justify-between gap-3 border-b border-border bg-background p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <label htmlFor="estructura-search" className="sr-only">
              Buscar asignatura
            </label>
            <input
              id="estructura-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por asignatura, carrera, plan, departamento o docente…"
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2 pr-9 text-xs text-ink shadow-sm outline-none transition focus:border-primary"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="filtro-ciclo-estructura" className="sr-only">
              Ciclo lectivo de los equipos
            </label>
            <select
              id="filtro-ciclo-estructura"
              value={S.ciclo}
              onChange={(e) => router.push(`${pathname}?ciclo=${e.target.value}`)}
              className={selectCls}
              title="Ciclo lectivo de los equipos de cátedra"
            >
              {ciclos.map((c) => (
                <option key={c} value={c}>
                  Ciclo {c}
                </option>
              ))}
            </select>
            <label htmlFor="filtro-carrera" className="sr-only">
              Filtrar por carrera
            </label>
            <select id="filtro-carrera" value={filterCarrera} onChange={(e) => setFilterCarrera(e.target.value)} className={selectCls}>
              <option value="ALL">Todas las carreras</option>
              {S.carreras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} — {c.nombre}
                </option>
              ))}
            </select>
            <label htmlFor="filtro-regimen" className="sr-only">
              Filtrar por régimen
            </label>
            <select id="filtro-regimen" value={filterRegimen} onChange={(e) => setFilterRegimen(e.target.value as FiltroRegimen)} className={selectCls}>
              <option value="ALL">Todos los regímenes</option>
              <option value="ANUAL">Anual</option>
              <option value="1C">1.º Cuatrimestre (1C)</option>
              <option value="2C">2.º Cuatrimestre (2C)</option>
            </select>
            <div className="flex items-center gap-1.5 border-l border-border pl-2 text-xs">
              <button
                type="button"
                onClick={expandAll}
                disabled={isSearching}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 font-semibold text-primary transition hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                Expandir
              </button>
              <button
                type="button"
                onClick={collapseAll}
                disabled={isSearching}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-muted transition hover:bg-background hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                Contraer
              </button>
            </div>
          </div>
        </div>

        {isSearching && (
          <div aria-live="polite" className="flex items-center justify-between border-b border-border bg-soft px-5 py-2 text-xs">
            <span className="font-semibold text-primary">
              Mostrando {matchingAsigIds.size} de {S.asignaturas.length} asignatura(s)
            </span>
            <button type="button" onClick={resetFiltros} className="text-[11px] font-semibold text-primary hover:underline">
              Restablecer filtros
            </button>
          </div>
        )}

        <div className="space-y-2 p-5">
          {matchingAsigIds.size === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-ink">No encontramos asignaturas con esos criterios</p>
              <p className="mt-1 text-xs text-muted">Probá con otro término o quitá algún filtro.</p>
            </div>
          ) : (
            S.sedes.map(renderSede)
          )}
        </div>
      </section>

      {carreraDetalle && (
        <CarreraDetalleModal
          carrera={carreraDetalle}
          sede={S.sedes.find((s) => s.id === carreraDetalle.sedeId)?.nombre ?? '—'}
          departamento={deptoNombre(carreraDetalle.departamentoId) ?? '—'}
          planes={S.planes.filter((p) => p.carreraId === carreraDetalle.id)}
          asignaturas={S.asignaturas.filter((a) => a.carreraId === carreraDetalle.id)}
          equipoDeAsig={equipoDeAsig}
          departamentoNombre={deptoNombre}
          ciclo={S.ciclo}
          onGestionarEquipo={(asigId) => {
            setOrigenCarreraId(carreraDetalle.id);
            setCarreraDetalleId(null);
            setModalAsigId(asigId);
          }}
          onClose={() => setCarreraDetalleId(null)}
        />
      )}

      {modalAsig && modalCar && (
        <EquipoCatedraModal
          key={`${modalAsig.id}:${S.ciclo}`}
          asignatura={modalAsig}
          contexto={[S.sedes.find((s) => s.id === modalCar.sedeId)?.nombre ?? '', `${modalCar.codigo} · ${modalPlan?.ordenanza ?? ''} (${modalPlan?.enfoque ?? ''})`].filter(Boolean)}
          radicacionMatricial={modalAsig.departamentoRadicacionId !== modalCar.departamentoId ? (deptoNombre(modalAsig.departamentoRadicacionId) ?? null) : null}
          ciclo={S.ciclo}
          equipo={equipoDeAsig(modalAsig.id)}
          docentes={S.docentes}
          estadoPlanif={S.estadoPlanif[modalAsig.id] ?? null}
          onClose={cerrarEquipo}
        />
      )}
    </div>
  );
}
