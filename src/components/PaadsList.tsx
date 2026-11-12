'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';

export interface PaadFila {
  id: string;
  docente: string;
  cycle: number;
  state: string;
  evalCareer: string | null;
  evalSigla: string | null;
  conflicto: boolean;
  pendientes: number;
  catedras: { carrera: string; asignatura: string; cargo: string }[];
}

const TODOS = 'ALL';
const POR_PAGINA = 10;

const ESTADOS: { key: string; label: string }[] = [
  { key: 'BORRADOR', label: 'Borrador' },
  { key: 'ENVIADO_A_REVISION', label: 'En revisión' },
  { key: 'OBSERVADO', label: 'Observado' },
  { key: 'APROBADO', label: 'PAAD Aprobado' },
];

/** Aprobación simple: los estados del circuito anterior (una sola conformidad) cuentan como aprobados. */
const estadoNormalizado = (s: string) => (s === 'APROBADO_UAP' || s === 'APROBADO_DIRECCION' ? 'APROBADO' : s);

const controlCls = 'w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs text-ink outline-none transition focus:border-primary';
const labelCls = 'mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted';

/** Bandeja de PAAD (UAP, Dirección de Carrera y Administración). Se remonta con cada URL para tomar los filtros. */
export function PaadsList(props: { filas: PaadFila[]; carreras: { id: string; sigla: string; nombre: string }[] }) {
  const params = useSearchParams();
  return <Bandeja key={params.toString()} {...props} params={params} />;
}

function Bandeja({ filas, carreras, params }: { filas: PaadFila[]; carreras: { id: string; sigla: string; nombre: string }[]; params: ReturnType<typeof useSearchParams> }) {
  const router = useRouter();
  const anio = new Date().getFullYear();
  const ini = {
    careerId: params.get('careerId') ?? undefined,
    state: params.get('state') ?? params.get('estado') ?? undefined,
    search: params.get('search') ?? params.get('q') ?? undefined,
    ciclo: params.get('ciclo') === 'todos' ? 0 : Number(params.get('ciclo')) || undefined,
  };
  const desdeUrl = Object.values(ini).some((v) => v !== undefined);

  const [search, setSearch] = useState(ini.search ?? '');
  const [filtroCarrera, setFiltroCarrera] = useState(ini.careerId ?? TODOS);
  const [filtroEstado, setFiltroEstado] = useState(ini.state ? estadoNormalizado(ini.state) : TODOS);
  const [filtroCiclo, setFiltroCiclo] = useState<number>(ini.ciclo ?? anio);
  const [pagina, setPagina] = useState(1);

  const ciclos = [...new Set([anio, ...filas.map((f) => f.cycle)])].sort((a, b) => b - a);
  const q = search.trim().toLocaleLowerCase('es');
  const filtradas = filas.filter((d) => {
    if (filtroCiclo !== 0 && d.cycle !== filtroCiclo) return false;
    if (filtroCarrera !== TODOS && d.evalCareer !== filtroCarrera) return false;
    if (filtroEstado !== TODOS && estadoNormalizado(d.state) !== filtroEstado) return false;
    if (!q) return true;
    return `${d.docente} ${d.catedras.map((c) => `${c.asignatura} ${c.carrera}`).join(' ')}`.toLocaleLowerCase('es').includes(q);
  });

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const filasPagina = filtradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const hayFiltros = q !== '' || filtroCarrera !== TODOS || filtroEstado !== TODOS || filtroCiclo !== anio;

  const conReset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPagina(1);
    };

  const restablecer = () => {
    if (desdeUrl) return router.replace('/paads');
    setSearch('');
    setFiltroCarrera(TODOS);
    setFiltroEstado(TODOS);
    setFiltroCiclo(anio);
    setPagina(1);
  };

  const descripcionUrl = [
    ini.careerId && `Dirección ${carreras.find((c) => c.id === ini.careerId)?.sigla ?? ''}`.trim(),
    ini.state && (ESTADOS.find((e) => e.key === estadoNormalizado(ini.state!))?.label ?? ini.state),
    ini.ciclo && `Ciclo ${ini.ciclo}`,
    ini.search && `«${ini.search}»`,
  ].filter(Boolean);

  return (
    <section aria-labelledby="paads-heading" className="w-full overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex items-center gap-2 px-4 pt-4 sm:px-5">
        <h2 id="paads-heading" className="text-sm font-bold text-ink">
          Planes anuales
        </h2>
        <span aria-live="polite" className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-muted">
          {filtradas.length} PAAD
        </span>
      </div>

      {/* Filtros recibidos desde Inicio */}
      {desdeUrl && descripcionUrl.length > 0 && (
        <div role="status" className="mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-soft px-3 py-2 text-[11px] text-ink sm:mx-5">
          <span className="font-semibold text-primary">Filtro aplicado desde Inicio</span>
          <span className="text-muted">{descripcionUrl.join(' · ')}</span>
          <button type="button" onClick={restablecer} className="ml-auto font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            Restablecer
          </button>
        </div>
      )}

      {/* Barra de filtros */}
      <div role="search" aria-label="Filtros de PAAD" className="grid grid-cols-1 gap-3 border-b border-border px-4 py-3 sm:grid-cols-2 sm:px-5 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
        <div>
          <label htmlFor="pd-buscar" className={labelCls}>
            Buscar
          </label>
          <input id="pd-buscar" type="search" value={search} onChange={(e) => conReset(setSearch)(e.target.value)} placeholder="Docente o asignatura…" className={controlCls} />
        </div>
        <div>
          <label htmlFor="pd-carrera" className={labelCls}>
            Dirección evaluadora
          </label>
          <select id="pd-carrera" value={filtroCarrera} onChange={(e) => conReset(setFiltroCarrera)(e.target.value)} className={controlCls}>
            <option value={TODOS}>Todas</option>
            {carreras.map((c) => (
              <option key={c.id} value={c.id} title={c.nombre}>
                Dirección {c.sigla}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pd-ciclo" className={labelCls}>
            Ciclo lectivo
          </label>
          <select id="pd-ciclo" value={filtroCiclo} onChange={(e) => conReset(setFiltroCiclo)(Number(e.target.value))} className={controlCls}>
            <option value={0}>Todos</option>
            {ciclos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pd-estado" className={labelCls}>
            Estado
          </label>
          <select id="pd-estado" value={filtroEstado} onChange={(e) => conReset(setFiltroEstado)(e.target.value)} className={controlCls}>
            <option value={TODOS}>Todos</option>
            {ESTADOS.map((e) => (
              <option key={e.key} value={e.key}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={restablecer}
          disabled={!hayFiltros && !desdeUrl}
          className="rounded-lg px-3 py-2 text-xs font-medium text-muted transition hover:bg-background hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          ↺ Limpiar
        </button>
      </div>

      <div className="overflow-x-auto">
        {/* table-fixed + anchos por columna (suman 100%): los encabezados no se mueven al filtrar ni con 0 resultados. */}
        <table className="w-full min-w-[900px] table-fixed border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-background text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th scope="col" className="w-[20%] px-4 py-3">
                Docente
              </th>
              <th scope="col" className="w-[8%] px-4 py-3">
                Ciclo
              </th>
              <th scope="col" className="w-[32%] px-4 py-3">
                Cátedras en el ciclo
              </th>
              <th scope="col" className="w-[15%] px-4 py-3">
                Dirección evaluadora
              </th>
              <th scope="col" className="w-[15%] px-4 py-3">
                Estado PAAD
              </th>
              <th scope="col" className="w-[10%] px-4 py-3 text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filasPagina.map((d) => (
              <tr key={d.id} className="transition hover:bg-background">
                <td className="min-w-0 px-4 py-3 font-bold text-ink">
                  <span className="block break-words">{d.docente}</span>
                  {d.conflicto && <span className="mt-1 block text-[11px] font-medium text-amber-700 dark:text-amber-400">Conflicto de copias pendiente</span>}
                </td>
                <td className="px-4 py-3 tabular-nums text-ink">{d.cycle}</td>
                <td className="min-w-0 space-y-1 px-4 py-3">
                  {d.catedras.length === 0 && <span className="text-muted">—</span>}
                  {d.catedras.map((c) => (
                    <div key={`${c.carrera}-${c.asignatura}`} className="break-words text-[11px] text-ink">
                      <span className="font-semibold text-primary">{c.carrera}</span> · {c.asignatura} <span className="text-muted">({c.cargo})</span>
                    </div>
                  ))}
                </td>
                <td className="min-w-0 px-4 py-3">
                  {d.evalSigla ? (
                    <span className="inline-block max-w-full truncate rounded bg-soft px-2.5 py-1 text-[11px] font-semibold text-primary">Dirección {d.evalSigla}</span>
                  ) : (
                    <span className="text-[11px] text-muted">Dirección pendiente</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge estado={d.state} pendientes={d.pendientes} />
                </td>
                <td className="px-4 py-3 text-right">
                  {/* Única acción: la revisión, observación y aprobación se hacen dentro del PAAD. */}
                  <Link
                    href={`/paads/${d.id}`}
                    className="inline-flex rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Ver PAAD
                  </Link>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-muted">
                  No se encontraron PAADs con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtradas.length > 0 && (
        <nav aria-label="Paginación de PAAD" className="flex flex-col gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[11px] tabular-nums text-muted">
            Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, filtradas.length)} de {filtradas.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={paginaActual <= 1}
              onClick={() => setPagina(paginaActual - 1)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] font-medium text-ink hover:bg-soft disabled:pointer-events-none disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="min-w-[96px] text-center text-[11px] tabular-nums text-muted">
              Página {paginaActual} de {totalPaginas}
            </span>
            <button
              type="button"
              disabled={paginaActual >= totalPaginas}
              onClick={() => setPagina(paginaActual + 1)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] font-medium text-ink hover:bg-soft disabled:pointer-events-none disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
