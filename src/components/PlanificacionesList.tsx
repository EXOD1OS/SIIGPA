'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { setSelectedCycle } from '@/redux/slices/planificationSlice';
import { StatusBadge } from '@/components/StatusBadge';
import { IconLock } from '@/components/layout/icons';
import { InformesModal } from '@/components/informes/InformesModal';
import { AccionProtocolo, type DocProtocolo } from '@/components/planificaciones/ProtocolizacionModal';
import {
  DICTAMEN_BADGE,
  DICTAMEN_LABELS,
  ESTADO_LABELS,
  ESTADOS_ACTIVOS,
  ESTADOS_HISTORICOS,
  ETAPA_PAAC,
  etapaPaac,
  type Dictamen,
} from '@/types/planificacion';

export interface PlanifFila {
  id: string;
  asignatura: string;
  carreraId: string;
  carreraSigla: string;
  carreraNombre: string;
  cycle: number;
  regimen: string;
  responsable: string;
  state: string;
  /** El PAAC tiene contenido cargado (además del encabezado). */
  iniciado: boolean;
  ped: Dictamen;
  disc: Dictamen;
  /** Observaciones del PAAC sin subsanar. */
  pendientes: number;
  expediente: string | null;
  resolucion: string | null;
  /** La sesión puede editar el PAAC (docente responsable, en Borrador u Observado). */
  editable: boolean;
  /** Consejo / Administración: datos de la protocolización pendiente (null = no corresponde). */
  protocolo: DocProtocolo | null;
}

type Vista = 'activas' | 'historicas';
const TODOS = 'ALL';
const POR_PAGINA = 10;
const REGIMENES: Record<string, string> = { ANUAL: 'Anual', '1C': '1er cuatrimestre', '2C': '2do cuatrimestre' };

const controlCls =
  'w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs text-ink outline-none transition focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed';
const labelCls = 'mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted';
const thCls = 'px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide';
const btnFila =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink transition-colors hover:border-primary hover:bg-soft hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary';

function DictamenChip({ area, value }: { area: string; value: Dictamen }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-semibold ${DICTAMEN_BADGE[value]}`}>
      <span className="opacity-70">{area}:</span> {DICTAMEN_LABELS[value]}
    </span>
  );
}

function DocIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5 shrink-0">
      <path d="M5 2.5h6.5L15 6v11.5H5z" strokeLinejoin="round" />
      <path d="M11.5 2.5V6H15M7.5 10h5M7.5 13h5" strokeLinecap="round" />
    </svg>
  );
}

/** Columna PAAC: acceso al editor/visor según la etapa del documento ("Presentado", "Correcciones", ...). */
function PaacCelda({ fila }: { fila: PlanifFila }) {
  const etapa = etapaPaac(fila.state, fila.iniciado);
  const { label, cls } = ETAPA_PAAC[etapa];
  const btnBase =
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary';
  const href = `/planificaciones/${fila.id}`;

  if (etapa === 'SIN_INICIAR') {
    return fila.editable ? (
      <Link href={href} aria-label={`Iniciar PAAC de ${fila.asignatura}`} className={`${btnBase} bg-primary text-white hover:bg-primary-hover`}>
        <span aria-hidden>+</span> Iniciar PAAC
      </Link>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-[11px] font-medium text-muted">
        <DocIcon /> Pendiente
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Link
        href={href}
        aria-label={`${fila.editable ? 'Editar' : 'Ver'} PAAC de ${fila.asignatura}`}
        className={`${btnBase} border border-border bg-surface text-primary hover:border-primary hover:bg-soft`}
      >
        <DocIcon /> {fila.editable ? 'Editar PAAC' : 'Ver PAAC'}
      </Link>
      <span className={`text-[10px] font-semibold ${cls}`}>{label}</span>
    </div>
  );
}

/** Bandeja de planificaciones. Se remonta con cada cambio de URL para tomar los filtros del deep-link. */
export function PlanificacionesList({ filas }: { filas: PlanifFila[] }) {
  const params = useSearchParams();
  return <Bandeja key={params.toString()} filas={filas} params={params} />;
}

function Bandeja({ filas, params }: { filas: PlanifFila[]; params: URLSearchParams | ReturnType<typeof useSearchParams> }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const cicloRedux = useAppSelector((s) => s.planification.selectedCycle);

  // Filtros iniciales desde la URL (dashboards): careerId, state (o el antiguo `estado`), regimen, search, ciclo, vista.
  const ini = {
    careerId: params.get('careerId') ?? undefined,
    state: params.get('state') ?? params.get('estado') ?? undefined,
    regimen: params.get('regimen') ?? undefined,
    search: params.get('search') ?? undefined,
    ciclo: Number(params.get('ciclo')) || undefined,
    vista: (params.get('vista') as Vista | null) ?? undefined,
  };
  const desdeUrl = Object.values(ini).some((v) => v !== undefined);

  const [vista, setVista] = useState<Vista>(() => ini.vista ?? (ini.state && ESTADOS_HISTORICOS.includes(ini.state) ? 'historicas' : 'activas'));
  const [query, setQuery] = useState(ini.search ?? '');
  const [filtroCarrera, setFiltroCarrera] = useState(ini.careerId ?? TODOS);
  const [filtroEstado, setFiltroEstado] = useState(ini.state ?? TODOS);
  const [filtroRegimen, setFiltroRegimen] = useState(ini.regimen ?? TODOS);
  const [pagina, setPagina] = useState(1);
  const [informesId, setInformesId] = useState<string | null>(null);
  const filaInformes = informesId ? filas.find((f) => f.id === informesId) : undefined;
  // 0 = todos los ciclos. Se sincroniza con Redux (lo muestra el Header); un deep-link con ciclo manda.
  const [filtroCiclo, setFiltroCiclo] = useState<number>(ini.ciclo ?? cicloRedux);
  const cambiarCiclo = (c: number) => {
    setFiltroCiclo(c);
    dispatch(setSelectedCycle(c));
    setPagina(1);
  };

  useEffect(() => {
    if (ini.ciclo) dispatch(setSelectedCycle(ini.ciclo));
    // Solo al montar (la vista se remonta con cada URL).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const esHistorica = (f: PlanifFila) => ESTADOS_HISTORICOS.includes(f.state);
  const enVista = filas.filter((f) => (vista === 'historicas' ? esHistorica(f) : !esHistorica(f)));
  const totalActivas = filas.filter((f) => !esHistorica(f)).length;

  // Opciones de filtros.
  const carreras = [...new Map(filas.map((f) => [f.carreraId, { id: f.carreraId, sigla: f.carreraSigla, nombre: f.carreraNombre }])).values()].sort((a, b) =>
    a.sigla.localeCompare(b.sigla, 'es')
  );
  const ciclos = [...new Set([new Date().getFullYear(), ...filas.map((f) => f.cycle)])].sort((a, b) => b - a);
  const regimenes = [...new Set(filas.map((f) => f.regimen))];
  const estadosOpciones = vista === 'historicas' ? ESTADOS_HISTORICOS : ESTADOS_ACTIVOS;

  // Filtros de la barra.
  const q = query.trim().toLocaleLowerCase('es');
  const filtradas = enVista
    .filter((f) => {
      if (filtroCarrera !== TODOS && f.carreraId !== filtroCarrera) return false;
      if (filtroCiclo !== 0 && f.cycle !== filtroCiclo) return false;
      // Desde Inicio, "En revisión" agrupa también las aprobaciones parciales (igual que los gráficos).
      const revisionAgrupada = filtroEstado === 'ENVIADO_A_REVISION' && filtroEstado === ini.state && ['APROBADO_PEDAGOGICO', 'APROBADO_DISCIPLINAR'].includes(f.state);
      if (filtroEstado !== TODOS && f.state !== filtroEstado && !revisionAgrupada) return false;
      if (filtroRegimen !== TODOS && f.regimen !== filtroRegimen) return false;
      if (!q) return true;
      return `${f.asignatura} ${f.responsable} ${f.carreraSigla}`.toLocaleLowerCase('es').includes(q);
    })
    .sort((a, b) => b.cycle - a.cycle || a.asignatura.localeCompare(b.asignatura, 'es'));

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const filasPagina = filtradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const hayFiltros = q !== '' || filtroCarrera !== TODOS || filtroCiclo !== new Date().getFullYear() || filtroEstado !== TODOS || filtroRegimen !== TODOS;

  const conReset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPagina(1);
    };

  const limpiarFiltros = () => {
    cambiarCiclo(new Date().getFullYear());
    if (desdeUrl) {
      router.replace('/planificaciones');
      return;
    }
    setQuery('');
    setFiltroCarrera(TODOS);
    setFiltroEstado(TODOS);
    setFiltroRegimen(TODOS);
    setPagina(1);
  };

  const cambiarVista = (v: Vista) => {
    setVista(v);
    setFiltroEstado(TODOS);
    setPagina(1);
  };

  const descripcionUrl = [
    ini.careerId && (carreras.find((c) => c.id === ini.careerId)?.sigla ?? 'Carrera'),
    ini.state && (ESTADO_LABELS[ini.state] ?? ini.state),
    ini.regimen && `Régimen ${REGIMENES[ini.regimen] ?? ini.regimen}`,
    ini.ciclo && `Ciclo ${ini.ciclo}`,
    ini.search && `«${ini.search}»`,
  ].filter(Boolean);

  return (
    <section aria-labelledby="bandeja-heading" className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      {/* Cabecera + selector de vista */}
      <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div className="flex items-center gap-2">
          <h2 id="bandeja-heading" className="text-sm font-bold text-ink">
            Bandeja de planificaciones
          </h2>
          <span aria-live="polite" className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-muted">
            {filtradas.length} {filtradas.length === 1 ? 'planificación' : 'planificaciones'}
          </span>
        </div>
        <div role="tablist" aria-label="Vista de planificaciones" className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs">
          {(
            [
              ['activas', 'En proceso', totalActivas],
              ['historicas', 'Históricas / Aprobadas', filas.length - totalActivas],
            ] as const
          ).map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={vista === key}
              onClick={() => cambiarVista(key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${vista === key ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-ink'}`}
            >
              {label}
              <span className="text-[10px] tabular-nums opacity-70">{n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filtros recibidos desde Inicio */}
      {desdeUrl && descripcionUrl.length > 0 && (
        <div role="status" className="mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-soft px-3 py-2 text-[11px] text-ink sm:mx-5">
          <span className="font-semibold text-primary">Filtro aplicado desde Inicio</span>
          <span className="text-muted">{descripcionUrl.join(' · ')}</span>
          <button type="button" onClick={limpiarFiltros} className="ml-auto font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            Restablecer
          </button>
        </div>
      )}

      {/* Barra de filtros */}
      <div
        role="search"
        aria-label="Filtros de planificaciones"
        className="grid grid-cols-1 gap-3 border-b border-border px-4 py-3 sm:grid-cols-2 sm:px-5 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end"
      >
        <div>
          <label htmlFor="pl-buscar" className={labelCls}>
            Buscar
          </label>
          <input
            id="pl-buscar"
            type="search"
            value={query}
            onChange={(e) => conReset(setQuery)(e.target.value)}
            placeholder="Asignatura, carrera o responsable…"
            className={controlCls}
          />
        </div>
        <div>
          <label htmlFor="pl-carrera" className={labelCls}>
            Carrera
          </label>
          <select id="pl-carrera" value={filtroCarrera} onChange={(e) => conReset(setFiltroCarrera)(e.target.value)} className={controlCls}>
            <option value={TODOS}>Todas</option>
            {carreras.map((c) => (
              <option key={c.id} value={c.id} title={c.nombre}>
                {c.sigla}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pl-ciclo" className={labelCls}>
            Ciclo lectivo
          </label>
          <select
            id="pl-ciclo"
            value={filtroCiclo}
            onChange={(e) => cambiarCiclo(Number(e.target.value))}
            className={controlCls}
          >
            <option value={0}>Todos</option>
            {ciclos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pl-regimen" className={labelCls}>
            Régimen
          </label>
          <select id="pl-regimen" value={filtroRegimen} onChange={(e) => conReset(setFiltroRegimen)(e.target.value)} className={controlCls}>
            <option value={TODOS}>Todos</option>
            {regimenes.map((r) => (
              <option key={r} value={r}>
                {REGIMENES[r] ?? r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pl-estado" className={labelCls}>
            Estado
          </label>
          <select id="pl-estado" value={filtroEstado} onChange={(e) => conReset(setFiltroEstado)(e.target.value)} className={controlCls}>
            <option value={TODOS}>Todos</option>
            {estadosOpciones.map((s) => (
              <option key={s} value={s}>
                {ESTADO_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={limpiarFiltros}
          disabled={!hayFiltros}
          className="rounded-lg px-3 py-2 text-xs font-medium text-muted transition hover:bg-background hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          ↺ Limpiar
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        {/* table-fixed + anchos por columna (suman 100%): los encabezados no se mueven al filtrar ni con 0 resultados. */}
        <table className="w-full min-w-[1180px] table-fixed border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-background text-muted">
              <th scope="col" className={`${thCls} w-[16%] pl-4 sm:pl-5`}>
                Asignatura
              </th>
              <th scope="col" className={`${thCls} w-[6%]`}>
                Carrera
              </th>
              <th scope="col" className={`${thCls} w-[5%]`}>
                Ciclo
              </th>
              <th scope="col" className={`${thCls} w-[11%]`}>
                Responsable
              </th>
              <th scope="col" className={`${thCls} w-[12%]`}>
                PAAC
              </th>
              <th scope="col" className={`${thCls} w-[14%]`}>
                Estado
              </th>
              <th scope="col" className={`${thCls} w-[13%]`}>
                Dictámenes
              </th>
              <th scope="col" className={`${thCls} w-[12%]`}>
                Expediente / Resolución
              </th>
              <th scope="col" className={`${thCls} w-[12%] pr-4 text-right sm:pr-5`}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filasPagina.map((f) => (
              <tr key={f.id} className="transition-colors hover:bg-background">
                <td className="min-w-0 px-3 py-3 pl-4 sm:pl-5">
                  <span className="block truncate font-semibold text-ink" title={f.asignatura}>
                    {f.asignatura}
                  </span>
                  <span className="block truncate text-[11px] text-muted">{REGIMENES[f.regimen] ?? f.regimen}</span>
                </td>
                <td className="px-3 py-3">
                  <span title={f.carreraNombre} className="inline-block cursor-help rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink">
                    {f.carreraSigla}
                  </span>
                  <span className="sr-only"> ({f.carreraNombre})</span>
                </td>
                <td className="px-3 py-3 tabular-nums text-ink">{f.cycle}</td>
                <td className="min-w-0 px-3 py-3 text-ink">
                  <span className="block truncate" title={f.responsable}>
                    {f.responsable}
                  </span>
                </td>
                <td className="min-w-0 px-3 py-3">
                  <PaacCelda fila={f} />
                </td>
                <td className="px-3 py-3">
                  {/* Sin texto extra en ELEVADO_AL_CONSEJO: el expediente tiene su propia columna. */}
                  <StatusBadge estado={f.state} pendientes={f.pendientes} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <DictamenChip area="Disc." value={f.disc} />
                    <DictamenChip area="Ped." value={f.ped} />
                  </div>
                </td>
                <td className="min-w-0 px-3 py-3 align-middle">
                  {f.expediente ? (
                    <div className="min-w-0 space-y-0.5">
                      <span className="block truncate font-mono text-xs font-semibold text-ink" title={f.expediente}>
                        {f.expediente}
                      </span>
                      {f.state === 'FINALIZADO' && f.resolucion ? (
                        <span className="flex min-w-0 items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400" title={`Resolución ${f.resolucion} · documento cerrado`}>
                          <IconLock className="h-3 w-3 shrink-0" />
                          <span className="truncate font-mono">{f.resolucion}</span>
                        </span>
                      ) : (
                        <span className="block text-[11px] text-muted">Resolución pendiente</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-3 pr-4 text-right align-middle sm:pr-5">
                  <div className="flex flex-wrap items-center justify-end gap-2 whitespace-nowrap">
                    {f.protocolo && <AccionProtocolo doc={f.protocolo} />}
                    {/* Solo consulta: se habilita cuando hay al menos un informe emitido (dictamen favorable). */}
                    <button
                      type="button"
                      onClick={() => setInformesId(f.id)}
                      disabled={f.ped !== 'FAVORABLE' && f.disc !== 'FAVORABLE'}
                      title={f.ped === 'FAVORABLE' || f.disc === 'FAVORABLE' ? undefined : 'Aún no hay informes emitidos'}
                      aria-label={`Ver informes de ${f.asignatura}`}
                      className={`${btnFila} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-surface disabled:hover:text-ink`}
                    >
                      Informes
                    </button>
                    <Link href={`/planificaciones/${f.id}`} className={btnFila} aria-label={`Abrir planificación de ${f.asignatura}`}>
                      Abrir
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center">
                  <p className="text-sm font-medium text-ink">No hay planificaciones para mostrar</p>
                  <p className="mt-1 text-xs text-muted">
                    {hayFiltros
                      ? 'Probá cambiar o quitar alguno de los filtros.'
                      : vista === 'activas'
                        ? 'No hay planificaciones en proceso. Revisá la pestaña de históricas.'
                        : 'Todavía no hay planificaciones aprobadas o finalizadas.'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtradas.length > 0 && (
        <nav aria-label="Paginación de planificaciones" className="flex flex-col gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
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

      {filaInformes && (
        <InformesModal
          planificacionId={filaInformes.id}
          asignatura={filaInformes.asignatura}
          estado={filaInformes.state}
          subtitulo={`${filaInformes.carreraSigla} · Ciclo ${filaInformes.cycle} · Responsable: ${filaInformes.responsable}`}
          onClose={() => setInformesId(null)}
        />
      )}
    </section>
  );
}
