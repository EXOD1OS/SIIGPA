'use client';

import { useId, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { IconAlert, IconArrowRight, IconCheck, IconClock, IconDocs } from '@/components/layout/icons';
import { BarraApilada, BarraProgreso, ChipArea, Dona, Leyenda, estirado, type Segmento } from './DashboardKit';
import { areaDe, pct, regimenLabel, type DatosDashboard, type NavDashboard } from './datos';

// ---------------------------------------------------------------------------
// Agrupación de estados del PAAC
// ---------------------------------------------------------------------------

type Grupo = 'aprobados' | 'revision' | 'observados' | 'borrador';
type Filtro = 'todos' | 'aprobados' | 'revision' | 'pendientes';

const GRUPO_DE: Record<string, Grupo> = {
  APROBADO_PLENO: 'aprobados',
  ELEVADO_AL_CONSEJO: 'aprobados',
  FINALIZADO: 'aprobados',
  ENVIADO_A_REVISION: 'revision',
  APROBADO_PEDAGOGICO: 'revision',
  APROBADO_DISCIPLINAR: 'revision',
  OBSERVADO: 'observados',
  BORRADOR: 'borrador',
};

/** Colores de estado (fijos por estado, nunca por posición). */
const SERIE: Record<Grupo, { label: string; color: string }> = {
  aprobados: { label: 'Aprobados', color: '#10b981' },
  revision: { label: 'En revisión', color: '#3b82f6' },
  observados: { label: 'Observados / Correcciones', color: '#f59e0b' },
  borrador: { label: 'Pendientes en borrador', color: '#94a3b8' },
};
const ORDEN: Grupo[] = ['aprobados', 'revision', 'observados', 'borrador'];

const enFiltro = (g: Grupo, f: Filtro) =>
  f === 'todos' || (f === 'aprobados' && g === 'aprobados') || (f === 'revision' && g === 'revision') || (f === 'pendientes' && (g === 'observados' || g === 'borrador'));

// `primary`, `soft` y `border` son variables CSS sin canal alfa: se usa color-mix en lugar de `/NN`.
const tarjetaCls =
  'group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ' +
  'hover:bg-[color:color-mix(in_srgb,var(--soft)_40%,var(--surface))] hover:border-[color:color-mix(in_srgb,var(--primary)_50%,transparent)] focus-within:border-primary';

/** Panel de inicio del docente: su PAAD anual, sus PAAC del ciclo y las observaciones a subsanar. */
export function DocenteDashboardView({ datos, nav, onVerMiPaad }: { datos: DatosDashboard; nav: NavDashboard; onVerMiPaad: () => void }) {
  const { uid, nombre, ciclo } = datos;
  const idBase = useId();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [activo, setActivo] = useState<string | null>(null);

  const paad = datos.paads.find((p) => p.owner === uid && p.cycle === ciclo);

  // PAAC de las cátedras del docente en el ciclo (responsable o integrante del equipo).
  const filas = datos.paacs
    .filter((d) => d.cycle === ciclo && (d.responsableId === uid || d.equipo.some((e) => e.docenteId === uid)))
    .map((d) => {
      const esResponsable = d.responsableId === uid;
      return {
        d,
        esResponsable,
        cargo: d.equipo.find((e) => e.docenteId === uid)?.cargo,
        grupo: GRUPO_DE[d.state] ?? 'borrador',
        pendientes: d.comments.filter((o) => !o.resolved).length,
      };
    })
    .sort((a, b) => Number(b.esResponsable) - Number(a.esResponsable) || a.d.asignatura.localeCompare(b.d.asignatura, 'es'));

  const total = filas.length;
  const conteo = ORDEN.reduce((acc, g) => ({ ...acc, [g]: filas.filter((f) => f.grupo === g).length }), {} as Record<Grupo, number>);
  const respCount = filas.filter((f) => f.esResponsable).length;
  const intCount = total - respCount;

  // Observaciones sin subsanar en el PAAD y en los PAAC del docente.
  const obsPaad = (paad?.comments ?? []).filter((o) => !o.resolved);
  const alertas = [
    ...obsPaad.map((o) => ({ o, abrir: onVerMiPaad, doc: 'Mi PAAD Anual' })),
    ...filas.flatMap((f) => f.d.comments.filter((o) => !o.resolved).map((o) => ({ o, abrir: () => nav.onOpenDoc(f.d.id), doc: `PAAC · ${f.d.asignatura}` }))),
  ];

  // Salud de subsanaciones en las cátedras.
  const obsTotales = filas.reduce((s, f) => s + f.d.comments.length, 0);
  const obsResueltas = filas.reduce((s, f) => s + f.d.comments.filter((o) => o.resolved).length, 0);

  const progPaad = paad?.progreso ?? { completados: 0, total: 8, pct: 0 };

  const kpis: { key: Filtro; titulo: string; valor: number; detalle: string; color?: string; Icon: typeof IconDocs }[] = [
    { key: 'todos', titulo: 'Cátedras afectadas', valor: total, detalle: `${respCount} como responsable · ${intCount} como integrante`, Icon: IconDocs },
    { key: 'aprobados', titulo: 'Aprobados / Finalizados', valor: conteo.aprobados, detalle: `${pct(conteo.aprobados, total)}% del total`, color: SERIE.aprobados.color, Icon: IconCheck },
    { key: 'revision', titulo: 'En revisión / Aprob. parcial', valor: conteo.revision, detalle: `${pct(conteo.revision, total)}% del total`, color: SERIE.revision.color, Icon: IconClock },
    {
      key: 'pendientes',
      titulo: 'Pendientes / Con observaciones',
      valor: conteo.observados + conteo.borrador,
      detalle: `${pct(conteo.observados + conteo.borrador, total)}% del total`,
      color: SERIE.observados.color,
      Icon: IconAlert,
    },
  ];

  const segmentos: Segmento[] = ORDEN.map((g) => ({ key: g, label: SERIE[g].label, valor: conteo[g], color: SERIE[g].color }));
  const filasVisibles = filas.filter((f) => enFiltro(f.grupo, filtro));

  const accionPaad = !paad
    ? null
    : paad.state === 'BORRADOR'
      ? { label: 'Completar y presentar PAAD', cls: 'bg-primary text-white group-hover:bg-primary-hover' }
      : paad.state === 'OBSERVADO'
        ? { label: `Subsanar observaciones del PAAD (${obsPaad.length})`, cls: 'border border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300 group-hover:bg-amber-600 group-hover:text-white' }
        : { label: 'Consultar mi PAAD Anual', cls: 'border border-border bg-background text-ink group-hover:text-primary' };

  return (
    <div className="space-y-6">
      {/* A. Bienvenida (sin etiqueta fija de rol: solo el resumen de cátedras) */}
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Hola, {nombre}</h1>
          <p className="mt-1 text-xs text-muted">
            Ciclo Lectivo {ciclo} · {total} {total === 1 ? 'cátedra asignada' : 'cátedras asignadas'} ({respCount} como responsable · {intCount} como integrante)
          </p>
        </div>
        {alertas.length > 0 && (
          <button
            type="button"
            onClick={alertas[0].abrir}
            className="inline-flex items-center gap-2 self-start rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:text-amber-200 sm:self-auto"
          >
            <IconAlert className="h-4 w-4" />
            Tenés {alertas.length} observación(es) pendiente(s) de subsanar
            <IconArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </header>

      {/* Grilla superior: Mi PAAD Anual + Estado de mis PAAC (misma altura, pies alineados) */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <section
          aria-labelledby={`${idBase}-paad`}
          className={`${paad ? tarjetaCls : 'relative flex flex-col gap-4 rounded-2xl border border-border bg-surface shadow-sm'} justify-between !p-6 lg:col-span-4`}
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Anexo III · Ord. 171/19</p>
                <h2 id={`${idBase}-paad`} className="text-base font-bold text-ink transition-colors group-hover:text-primary">
                  Mi PAAD Anual {ciclo}
                </h2>
              </div>
              {paad && <StatusBadge estado={paad.state} />}
            </div>
            {paad ? (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">Puntos 1 al {progPaad.total} completados</span>
                    <span className="tabular-nums">
                      <strong className="font-bold text-ink">{progPaad.pct}%</strong>
                      <span className="ml-1 text-muted">
                        ({progPaad.completados}/{progPaad.total})
                      </span>
                    </span>
                  </div>
                  <BarraProgreso valor={progPaad.pct} etiqueta="Avance del PAAD" />
                </div>
                <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border text-xs">
                  <div className="bg-surface px-3 py-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">Cátedras vinculadas</dt>
                    <dd className="mt-0.5 font-bold tabular-nums text-ink">{total}</dd>
                  </div>
                  <div className="bg-surface px-3 py-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">Obs. pendientes</dt>
                    <dd className={`mt-0.5 font-bold tabular-nums ${obsPaad.length ? 'text-amber-600 dark:text-amber-400' : 'text-ink'}`}>{obsPaad.length}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="text-xs text-muted">Todavía no tenés un PAAD para este ciclo. Cuando Administración lo genere, lo vas a encontrar acá.</p>
            )}
          </div>
          {paad && accionPaad && (
            // Botón estirado: toda la tarjeta abre el PAAD; el pie queda alineado al fondo.
            <button
              type="button"
              onClick={onVerMiPaad}
              className={`${estirado} flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm transition ${accionPaad.cls}`}
            >
              {accionPaad.label}
              <IconArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </button>
          )}
        </section>

        <section aria-labelledby={`${idBase}-dist`} className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-surface p-6 shadow-sm lg:col-span-8">
          <h2 id={`${idBase}-dist`} className="text-base font-bold text-ink">
            Estado de mis PAAC
          </h2>
          {total === 0 ? (
            <p className="text-xs text-muted">No integrás equipos de cátedra con PAAC en el ciclo {ciclo}.</p>
          ) : (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Dona segmentos={segmentos} total={total} centro="PAAC" activo={activo} onActivo={setActivo} />
              <div className="min-w-0 flex-1 space-y-4">
                <BarraApilada segmentos={segmentos} activo={activo} onActivo={setActivo} etiqueta="Estado de mis PAAC" />
                <Leyenda segmentos={segmentos} total={total} activo={activo} onActivo={setActivo} />
              </div>
            </div>
          )}
          {/* Pie alineado con el pie de la tarjeta del PAAD */}
          <div className="space-y-1.5 rounded-xl border border-border bg-background p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink">Salud de subsanaciones</span>
              <span className="tabular-nums text-muted">
                <strong className="text-ink">{obsResueltas}</strong> de {obsTotales} observaciones resueltas
              </span>
            </div>
            <BarraProgreso valor={obsTotales ? pct(obsResueltas, obsTotales) : 100} etiqueta="Observaciones resueltas en mis cátedras" />
          </div>
        </section>
      </div>

      {/* KPIs: misma altura; activos sin mover el contenido (borde fijo de 1px + ring) */}
      <div role="group" aria-label="Filtrar mis PAAC por estado" className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const sel = filtro === k.key;
          return (
            <button
              key={k.key}
              type="button"
              aria-pressed={sel}
              aria-controls={`${idBase}-lista`}
              onClick={() => setFiltro(sel && k.key !== 'todos' ? 'todos' : k.key)}
              className={`flex h-full cursor-pointer flex-col justify-between gap-3 rounded-2xl border p-5 text-left shadow-sm transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                sel
                  ? 'border-primary bg-[color:color-mix(in_srgb,var(--soft)_20%,var(--surface))] ring-1 ring-[color:color-mix(in_srgb,var(--primary)_30%,transparent)]'
                  : 'border-border bg-surface hover:border-[color:color-mix(in_srgb,var(--primary)_50%,transparent)]'
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold leading-snug text-muted">{k.titulo}</span>
                <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-soft text-primary" style={k.color ? { color: k.color } : undefined}>
                  <k.Icon className="h-4 w-4" />
                </span>
              </span>
              <span>
                <span className="block text-2xl font-bold tabular-nums text-ink">{k.valor}</span>
                <span className="mt-0.5 block text-[11px] text-muted">{k.detalle}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Grilla inferior: Mis PAAC + Observaciones (encabezados de igual altura) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <section aria-labelledby={`${idBase}-lista-titulo`} className="space-y-3.5 lg:col-span-8">
          <div className="flex h-7 items-center justify-between gap-2">
            <h2 id={`${idBase}-lista-titulo`} className="text-base font-bold text-ink">
              Mis PAAC del ciclo
              {filtro !== 'todos' && <span className="ml-2 text-xs font-normal text-muted">· filtrado ({filasVisibles.length})</span>}
            </h2>
            <button
              type="button"
              onClick={() => nav.goToPlanificaciones({ ciclo })}
              className="text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Ver todas las planificaciones →
            </button>
          </div>

          <ul id={`${idBase}-lista`} className="space-y-3.5">
            {filasVisibles.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-xs text-muted">No hay PAAC en este estado.</li>
            )}
            {filasVisibles.map(({ d, esResponsable, cargo, grupo, pendientes }) => (
              <li key={d.id} className={tarjetaCls}>
                {/* Acento lateral según el estado */}
                <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: SERIE[grupo].color }} />

                {/* 1. Cabecera: el nombre es el botón estirado (toda la tarjeta abre la planificación) */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-base font-bold text-ink transition-colors group-hover:text-primary">
                      <button type="button" onClick={() => nav.onOpenDoc(d.id)} className={`${estirado} min-w-0 truncate`} title={d.asignatura}>
                        {d.asignatura}
                      </button>
                      <IconArrowRight className="h-4 w-4 shrink-0 text-muted transition-all group-hover:translate-x-1 group-hover:text-primary" />
                    </h3>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-soft px-2 py-0.5 text-[11px] font-bold text-primary">{d.carreraSigla || '—'}</span>
                      <span className="text-muted">{d.ordenanza}</span>
                      <span aria-hidden className="text-muted">·</span>
                      <span className="font-medium text-ink">{regimenLabel(d.regimen)}</span>
                      <span aria-hidden className="text-muted">·</span>
                      <span className="text-ink">
                        {cargo ? `${cargo} · ` : ''}
                        <span className={esResponsable ? 'font-semibold text-primary' : 'text-muted'}>{esResponsable ? 'Responsable de presentar' : 'Integrante'}</span>
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge estado={d.state} />
                    {pendientes > 0 && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        {pendientes} obs. pendiente(s)
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Progreso */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">Progreso de carga del PAAC</span>
                    <span className="font-bold tabular-nums text-ink">{d.avance}%</span>
                  </div>
                  <BarraProgreso valor={d.avance} etiqueta={`Progreso de carga del PAAC de ${d.asignatura}`} />
                </div>

                {/* 3. Pie: dictámenes por área (sin botones sueltos: la tarjeta entera abre el PAAC) */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:color-mix(in_srgb,var(--border)_60%,transparent)] pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ChipArea area="UAP" estado={areaDe(d.ped)} />
                    <ChipArea area="Dirección" estado={areaDe(d.disc)} />
                  </div>
                  <span aria-hidden className="flex items-center gap-1 text-[11px] font-semibold text-muted transition-colors group-hover:text-primary">
                    Abrir planificación <span>→</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside aria-labelledby={`${idBase}-obs`} className="space-y-3.5 lg:col-span-4">
          <div className="flex h-7 items-center justify-between gap-2">
            <h2 id={`${idBase}-obs`} className="text-base font-bold text-ink">
              Observaciones recientes
            </h2>
            <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted">{alertas.length}</span>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:sticky lg:top-20">
            <p className="mb-3 text-[11px] text-muted">Pendientes de subsanar en tu PAAD y en tus PAAC. Hacé clic para abrir el documento.</p>
            {alertas.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                <IconCheck className="h-4 w-4" />
                No tenés observaciones pendientes.
              </p>
            ) : (
              <ul className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
                {alertas.map(({ o, abrir, doc }) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={abrir}
                      className="group/obs w-full cursor-pointer rounded-xl border border-border bg-background p-3 text-left transition hover:border-[color:color-mix(in_srgb,var(--primary)_40%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--soft)_30%,var(--bg))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-semibold text-ink group-hover/obs:text-primary">{doc}</span>
                        {o.area && (
                          <span
                            className={`shrink-0 rounded px-1.5 py-px text-[10px] font-bold ${
                              o.area === 'uap' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                            }`}
                          >
                            {o.area === 'uap' ? 'UAP' : 'Dirección'}
                          </span>
                        )}
                      </span>
                      {o.campoPath && <span className="mt-1 block truncate font-mono text-[10px] text-muted">{o.campoPath}</span>}
                      <span className="mt-1 line-clamp-2 block text-xs text-ink">{o.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
