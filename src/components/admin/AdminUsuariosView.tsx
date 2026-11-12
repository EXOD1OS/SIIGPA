'use client';

import { useMemo, useState } from 'react';
import { ROL_LABELS } from '@/types/planificacion';
import { UsuarioFormModal, type AsignaturaOpcion } from './UsuarioFormModal';
import { ROLES_ORDENADOS, ROL_BADGE, type Rol, type UsuarioAdmin } from './tipos';

interface Props {
  usuarios: UsuarioAdmin[];
  carreras: { id: string; codigo: string; nombre: string; departamentoId: string }[];
  departamentos: { id: string; nombre: string }[];
  asignaturas: AsignaturaOpcion[];
  ciclo: number;
  /** Id de la sesión (no puede eliminarse a sí misma). */
  sesionId: string;
}

type FiltroEstado = 'ALL' | 'CLAVE_PENDIENTE' | 'CLAVE_PERSONAL';
type FiltroAmbito = 'ALL' | `car:${string}` | `dep:${string}`;
type ModalState = { mode: 'create' } | { mode: 'edit'; userId: string } | null;

const POR_PAGINA = 10;
const controlCls = 'rounded-lg bg-surface border border-border px-3 py-2 text-xs text-ink outline-none transition focus:border-primary';

function PencilIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-3.5 w-3.5">
      <path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d={dir === 'left' ? 'm12.5 4.5-5 5 5 5' : 'm7.5 4.5 5 5-5 5'} />
    </svg>
  );
}

/** Usuarios y accesos: alta, edición, blanqueo de clave y baja con asignación de cátedras del ciclo. */
export function AdminUsuariosView({ usuarios, carreras, departamentos, asignaturas, ciclo, sesionId }: Props) {
  const [query, setQuery] = useState('');
  const [filtroRol, setFiltroRol] = useState<'ALL' | Rol>('ALL');
  const [filtroAmbito, setFiltroAmbito] = useState<FiltroAmbito>('ALL');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('ALL');
  const [pagina, setPagina] = useState(1);
  const [modal, setModal] = useState<ModalState>(null);

  const carreraBy = useMemo(() => new Map(carreras.map((c) => [c.id, c])), [carreras]);

  const ambitos = useMemo(() => {
    const map = new Map<string, { carreraIds: Set<string>; deptoIds: Set<string> }>();
    for (const u of usuarios) {
      const carreraIds = new Set<string>([...(u.carreraId ? [u.carreraId] : []), ...u.catedras.map((c) => c.carreraId)]);
      const deptoIds = new Set<string>([...carreraIds].map((id) => carreraBy.get(id)?.departamentoId ?? '').filter(Boolean));
      map.set(u.id, { carreraIds, deptoIds });
    }
    return map;
  }, [usuarios, carreraBy]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    return usuarios
      .filter((u) => {
        if (filtroRol !== 'ALL' && u.rol !== filtroRol) return false;
        if (filtroEstado === 'CLAVE_PENDIENTE' && !u.mustChangePassword) return false;
        if (filtroEstado === 'CLAVE_PERSONAL' && u.mustChangePassword) return false;
        if (filtroAmbito !== 'ALL') {
          const a = ambitos.get(u.id);
          const [tipo, id] = filtroAmbito.split(':');
          if (tipo === 'car' && !a?.carreraIds.has(id)) return false;
          if (tipo === 'dep' && !a?.deptoIds.has(id)) return false;
        }
        if (!q) return true;
        return [u.nombre, u.apellido, `${u.nombre} ${u.apellido}`, `${u.apellido} ${u.nombre}`, u.email, u.dni].some((v) => v.toLocaleLowerCase('es').includes(q));
      })
      .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'));
  }, [usuarios, ambitos, query, filtroRol, filtroAmbito, filtroEstado]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const filas = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const hayFiltros = query.trim() !== '' || filtroRol !== 'ALL' || filtroAmbito !== 'ALL' || filtroEstado !== 'ALL';

  const conReset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPagina(1);
    };
  const limpiarFiltros = () => {
    setQuery('');
    setFiltroRol('ALL');
    setFiltroAmbito('ALL');
    setFiltroEstado('ALL');
    setPagina(1);
  };

  /** Reglas que impiden la baja (el servidor además valida el historial académico). */
  const bloqueoEliminacion = (u: UsuarioAdmin): string | null => {
    if (u.id === sesionId) return 'es tu propia cuenta.';
    if (u.rol === 'ADMINISTRADOR' && usuarios.filter((x) => x.rol === 'ADMINISTRADOR').length === 1) return 'es el único administrador del sistema.';
    if (u.rol === 'DIRECCION_CARRERA' && u.carreraId) return `dirige ${carreraBy.get(u.carreraId)?.codigo ?? 'una carrera'}. Asigná otra Dirección de Carrera antes.`;
    const responsableDe = u.catedras.filter((c) => c.esResponsable).map((c) => c.asignaturaNombre);
    if (responsableDe.length) return `es Docente Responsable de ${responsableDe.join(', ')}. Designá otro responsable desde Estructura Académica.`;
    return null;
  };

  const ambitoTexto = (u: UsuarioAdmin) => {
    if (u.rol === 'DIRECCION_CARRERA') return { principal: carreraBy.get(u.carreraId ?? '')?.codigo ?? 'Sin carrera', secundario: 'Dirección de carrera' };
    if (u.rol === 'DOCENTE') {
      if (u.catedras.length === 0) return { principal: 'Sin cátedras', secundario: `Ciclo ${ciclo}` };
      const codigos = [...new Set(u.catedras.map((c) => c.carreraCodigo))];
      return {
        principal: u.catedras.map((c) => c.asignaturaNombre).join(', '),
        secundario: `${codigos.join(', ')} · ${u.catedras.length} cátedra(s)${u.catedras.some((c) => c.esResponsable) ? ' · Responsable' : ''}`,
      };
    }
    return { principal: 'Transversal', secundario: null };
  };

  const usuarioEditado = modal?.mode === 'edit' ? usuarios.find((u) => u.id === modal.userId) : undefined;

  return (
    <div className="space-y-6">
      <section aria-labelledby="usuarios-heading" className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5">
          <h2 id="usuarios-heading" className="text-sm font-bold text-ink">
            Usuarios registrados
          </h2>
          <span aria-live="polite" className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted">
            {filtrados.length} de {usuarios.length} usuarios
          </span>
        </div>

        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:px-5 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="usuarios-search" className="sr-only">
              Buscar por nombre, apellido, email o DNI
            </label>
            <input
              id="usuarios-search"
              type="search"
              value={query}
              onChange={(e) => conReset(setQuery)(e.target.value)}
              placeholder="Buscar por nombre, apellido, email o DNI…"
              className={`${controlCls} w-full`}
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:items-center">
            <label htmlFor="filtro-rol" className="sr-only">
              Filtrar por rol
            </label>
            <select id="filtro-rol" value={filtroRol} onChange={(e) => conReset(setFiltroRol)(e.target.value as 'ALL' | Rol)} className={controlCls}>
              <option value="ALL">Todos los roles</option>
              {ROLES_ORDENADOS.map((r) => (
                <option key={r} value={r}>
                  {ROL_LABELS[r] ?? r}
                </option>
              ))}
            </select>
            <label htmlFor="filtro-ambito" className="sr-only">
              Filtrar por carrera o departamento
            </label>
            <select id="filtro-ambito" value={filtroAmbito} onChange={(e) => conReset(setFiltroAmbito)(e.target.value as FiltroAmbito)} className={controlCls}>
              <option value="ALL">Todas las carreras / deptos.</option>
              <optgroup label="Carreras">
                {carreras.map((c) => (
                  <option key={c.id} value={`car:${c.id}`}>
                    {c.codigo} — {c.nombre}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Departamentos">
                {departamentos.map((d) => (
                  <option key={d.id} value={`dep:${d.id}`}>
                    {d.nombre}
                  </option>
                ))}
              </optgroup>
            </select>
            <label htmlFor="filtro-estado" className="sr-only">
              Filtrar por estado de la clave
            </label>
            <select id="filtro-estado" value={filtroEstado} onChange={(e) => conReset(setFiltroEstado)(e.target.value as FiltroEstado)} className={controlCls}>
              <option value="ALL">Todos los estados</option>
              <option value="CLAVE_PENDIENTE">Clave pendiente (DNI)</option>
              <option value="CLAVE_PERSONAL">Clave personal</option>
            </select>
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            {hayFiltros && (
              <button type="button" onClick={limpiarFiltros} className="rounded-lg px-3 py-2 text-xs font-medium text-muted transition hover:bg-background hover:text-ink">
                Limpiar
              </button>
            )}
            <button
              type="button"
              onClick={() => setModal({ mode: 'create' })}
              className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span aria-hidden className="text-sm leading-none">
                +
              </span>
              Nuevo usuario
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-background text-[11px] uppercase tracking-wide text-muted">
                <th scope="col" className="w-[28%] px-4 py-3 font-semibold sm:px-5">
                  Usuario
                </th>
                <th scope="col" className="w-[11%] px-3 py-3 font-semibold">
                  DNI
                </th>
                <th scope="col" className="w-[15%] px-3 py-3 font-semibold">
                  Rol
                </th>
                <th scope="col" className="w-[24%] px-3 py-3 font-semibold">
                  Carrera / Cátedras
                </th>
                <th scope="col" className="w-[12%] px-3 py-3 font-semibold">
                  Clave
                </th>
                <th scope="col" className="w-[10%] px-4 py-3 text-right font-semibold sm:px-5">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map((u) => {
                const amb = ambitoTexto(u);
                return (
                  <tr key={u.id} className="transition-colors hover:bg-background">
                    <td className="px-4 py-3 sm:px-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-soft text-[11px] font-bold text-primary">
                          {u.nombre.charAt(0)}
                          {u.apellido.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-ink">
                            {u.apellido}, {u.nombre}
                          </div>
                          <div className="truncate text-[11px] text-muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums text-ink">{u.dni}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-bold ${ROL_BADGE[u.rol] ?? ''}`}>{ROL_LABELS[u.rol] ?? u.rol}</span>
                    </td>
                    <td className="min-w-0 px-3 py-3">
                      <div className="truncate font-medium text-ink" title={amb.principal}>
                        {amb.principal}
                      </div>
                      {amb.secundario && <div className="truncate text-[11px] text-muted">{amb.secundario}</div>}
                    </td>
                    <td className="px-3 py-3">
                      {u.mustChangePassword ? (
                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">Pendiente (DNI)</span>
                      ) : (
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Personal</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-5">
                      <button
                        type="button"
                        onClick={() => setModal({ mode: 'edit', userId: u.id })}
                        aria-label={`Editar a ${u.nombre} ${u.apellido}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <PencilIcon />
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <p className="text-sm font-medium text-ink">No se encontraron usuarios</p>
                    <p className="mt-1 text-xs text-muted">Probá con otros términos o quitá algún filtro.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtrados.length > 0 && (
          <nav aria-label="Paginación de usuarios" className="flex flex-col gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-[11px] tabular-nums text-muted">
              Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, filtrados.length)} de {filtrados.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Página anterior"
                disabled={paginaActual <= 1}
                onClick={() => setPagina(paginaActual - 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-ink transition hover:bg-soft disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronIcon dir="left" />
              </button>
              <span className="min-w-[96px] text-center text-[11px] tabular-nums text-muted">
                Página {paginaActual} de {totalPaginas}
              </span>
              <button
                type="button"
                aria-label="Página siguiente"
                disabled={paginaActual >= totalPaginas}
                onClick={() => setPagina(paginaActual + 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-ink transition hover:bg-soft disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronIcon dir="right" />
              </button>
            </div>
          </nav>
        )}
      </section>

      {modal?.mode === 'create' && <UsuarioFormModal usuarios={usuarios} carreras={carreras} asignaturas={asignaturas} ciclo={ciclo} onClose={() => setModal(null)} />}
      {usuarioEditado && (
        <UsuarioFormModal
          key={usuarioEditado.id}
          usuario={usuarioEditado}
          usuarios={usuarios}
          carreras={carreras}
          asignaturas={asignaturas}
          ciclo={ciclo}
          bloqueoEliminacion={bloqueoEliminacion(usuarioEditado)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
