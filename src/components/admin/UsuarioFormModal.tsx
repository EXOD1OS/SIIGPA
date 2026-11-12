'use client';

import { useId, useMemo, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, ModalButton } from '@/components/shared/Modal';
import { actualizarUsuario, blanquearClaveDni, crearUsuario, eliminarUsuario, sincronizarCatedrasUsuario } from '@/actions/admin.actions';
import { ROL_LABELS } from '@/types/planificacion';
import { CARGOS_CATEDRA, CARGO_LABEL, ROLES_ORDENADOS, ROL_DESCRIPCION, type CatedraAsignada, type Rol, type UsuarioAdmin } from './tipos';

/** Integrante actual (guardado) de un equipo de cátedra. */
export interface MiembroEquipo {
  docenteId: string;
  nombre: string;
  cargo: string;
  esResponsable: boolean;
}

/** Asignatura ofrecida para asignar, con su contexto y equipo actual ya resueltos. */
export interface AsignaturaOpcion {
  id: string;
  nombre: string;
  carreraId: string;
  carreraCodigo: string;
  anoCursada: number;
  regimen: string;
  esMatricial: boolean;
  /** La planificación del ciclo ya salió de Borrador/Observado: su equipo no se modifica. */
  bloqueada: boolean;
  equipo: MiembroEquipo[];
}

interface Props {
  /** Sin usuario = alta. */
  usuario?: UsuarioAdmin;
  usuarios: UsuarioAdmin[];
  carreras: { id: string; codigo: string; nombre: string }[];
  asignaturas: AsignaturaOpcion[];
  ciclo: number;
  /** Motivo por el que no se puede eliminar (null si se puede intentar). */
  bloqueoEliminacion?: string | null;
  onClose: () => void;
}

interface Draft {
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  rol: Rol;
  carreraId: string | null;
  catedras: CatedraAsignada[];
}

type CampoError = 'nombre' | 'apellido' | 'email' | 'dni' | 'rol' | 'carreraId' | 'nuevaCatedra';
type Errores = Partial<Record<CampoError, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DNI_RE = /^\d{7,8}$/;

const inputCls = (err?: string) =>
  `w-full rounded-lg bg-surface border px-3 py-2 text-xs text-ink outline-none transition focus:border-primary disabled:opacity-60 ${err ? 'border-danger' : 'border-border'}`;

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>
      )}
    </div>
  );
}

/** Alta y edición de usuarios con la asignación de cátedras del ciclo (solo docentes). */
export function UsuarioFormModal({ usuario, usuarios, carreras, asignaturas, ciclo, bloqueoEliminacion = null, onClose }: Props) {
  const router = useRouter();
  const isEdit = !!usuario;
  const uid = useId();
  const formId = `${uid}-form`;
  const fid = (name: string) => `${uid}-${name}`;
  const [pending, start] = useTransition();

  const [inicial] = useState<Draft>(() =>
    usuario
      ? { nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email, dni: usuario.dni, rol: usuario.rol, carreraId: usuario.carreraId, catedras: usuario.catedras }
      : { nombre: '', apellido: '', email: '', dni: '', rol: 'DOCENTE', carreraId: null, catedras: [] },
  );
  const [draft, setDraft] = useState<Draft>(inicial);
  const [errores, setErrores] = useState<Errores>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [avisoClave, setAvisoClave] = useState<string | null>(null);

  const [selCarrera, setSelCarrera] = useState('');
  const [selAno, setSelAno] = useState<number | 'ALL'>('ALL');
  const [selAsig, setSelAsig] = useState('');
  const [selCargo, setSelCargo] = useState('');
  const [selResp, setSelResp] = useState(false);

  // Responsabilidades ya guardadas: no se quitan desde aquí (se cambian desde Estructura Académica).
  const [responsableGuardado] = useState(() => new Set((usuario?.catedras ?? []).filter((c) => c.esResponsable).map((c) => c.asignaturaId)));

  const asigBy = useMemo(() => new Map(asignaturas.map((a) => [a.id, a])), [asignaturas]);
  const esDocente = draft.rol === 'DOCENTE';
  const asignadas = new Set(draft.catedras.map((c) => c.asignaturaId));
  const asigsCarrera = asignaturas.filter((a) => a.carreraId === selCarrera);
  const anosCarrera = [...new Set(asigsCarrera.map((a) => a.anoCursada))].sort((a, b) => a - b);
  const asigsDisponibles = asigsCarrera
    .filter((a) => (selAno === 'ALL' || a.anoCursada === selAno) && !asignadas.has(a.id) && !a.bloqueada)
    .sort((a, b) => a.anoCursada - b.anoCursada || a.nombre.localeCompare(b.nombre, 'es'));
  const asigElegida = asigsDisponibles.find((a) => a.id === selAsig);
  const respActual = asigElegida?.equipo.find((m) => m.esResponsable);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrores((e) => ({ ...e, [key as CampoError]: undefined }));
  };
  const setCatedras = (fn: (prev: CatedraAsignada[]) => CatedraAsignada[]) => setDraft((d) => ({ ...d, catedras: fn(d.catedras) }));

  const cambiarRol = (rol: Rol) => {
    setDraft((d) => ({ ...d, rol, carreraId: rol === 'DIRECCION_CARRERA' ? (d.carreraId ?? carreras[0]?.id ?? null) : null }));
    setErrores((e) => ({ ...e, rol: undefined, carreraId: undefined }));
  };

  const elegirAsignatura = (id: string) => {
    setSelAsig(id);
    setSelCargo('');
    setSelResp(!!id && !asigBy.get(id)?.equipo.some((m) => m.esResponsable));
    setErrores((e) => ({ ...e, nuevaCatedra: undefined }));
  };

  const incorporar = () => {
    if (!asigElegida) return setErrores((e) => ({ ...e, nuevaCatedra: 'Seleccioná una asignatura.' }));
    if (!selCargo) return setErrores((e) => ({ ...e, nuevaCatedra: 'Seleccioná el cargo en el equipo.' }));
    setCatedras((prev) => [
      ...prev,
      { asignaturaId: asigElegida.id, asignaturaNombre: asigElegida.nombre, carreraId: asigElegida.carreraId, carreraCodigo: asigElegida.carreraCodigo, cargo: selCargo, esResponsable: selResp },
    ]);
    setSelAsig('');
    setSelCargo('');
    setSelResp(false);
    setErrores((e) => ({ ...e, nuevaCatedra: undefined }));
  };

  const validar = (): Errores => {
    const e: Errores = {};
    const email = draft.email.trim().toLowerCase();
    const otros = usuarios.filter((u) => u.id !== usuario?.id);
    if (!draft.nombre.trim()) e.nombre = 'Ingresá el nombre.';
    if (!draft.apellido.trim()) e.apellido = 'Ingresá el apellido.';
    if (!email) e.email = 'Ingresá el email institucional.';
    else if (!EMAIL_RE.test(email)) e.email = 'El email no tiene un formato válido.';
    else if (otros.some((u) => u.email.toLowerCase() === email)) e.email = 'Ya existe un usuario con ese email.';
    if (!DNI_RE.test(draft.dni.trim())) e.dni = 'El DNI debe tener 7 u 8 dígitos, sin puntos.';
    else if (otros.some((u) => u.dni === draft.dni.trim())) e.dni = 'Ya existe un usuario con ese DNI.';
    if (draft.rol === 'DIRECCION_CARRERA' && !draft.carreraId) e.carreraId = 'Seleccioná la carrera que dirige.';
    if (usuario && usuario.rol === 'DOCENTE' && draft.rol !== 'DOCENTE' && draft.catedras.length > 0) {
      e.rol = 'Integra equipos de cátedra: quitale sus cátedras (o designá otro responsable) antes de cambiar su rol.';
    }
    return e;
  };

  const catedrasCambiaron = JSON.stringify(draft.catedras) !== JSON.stringify(inicial.catedras);

  const handleSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    if (pending) return;
    const e = validar();
    setErrores(e);
    setErrorServidor(null);
    if (Object.keys(e).length > 0) return;

    const datos = {
      nombre: draft.nombre.trim(),
      apellido: draft.apellido.trim(),
      email: draft.email.trim().toLowerCase(),
      dni: draft.dni.trim(),
      rol: draft.rol,
      carreraId: draft.carreraId,
    };
    const catedras = draft.catedras.map((c) => ({ asignaturaId: c.asignaturaId, categoria: c.cargo, esResponsable: c.esResponsable }));
    start(async () => {
      try {
        let id = usuario?.id;
        if (usuario) {
          // Primero las cátedras (si deja de ser docente ya quedaron desvinculadas) y luego los datos.
          if (catedrasCambiaron && usuario.rol === 'DOCENTE') await sincronizarCatedrasUsuario(usuario.id, ciclo, esDocente ? catedras : []);
          await actualizarUsuario(usuario.id, datos);
          if (catedrasCambiaron && usuario.rol !== 'DOCENTE' && esDocente) await sincronizarCatedrasUsuario(usuario.id, ciclo, catedras);
        } else {
          id = (await crearUsuario(datos)).id;
          if (esDocente && catedras.length) await sincronizarCatedrasUsuario(id, ciclo, catedras);
        }
        router.refresh();
        onClose();
      } catch (err) {
        setErrorServidor(err instanceof Error ? err.message : 'No se pudo guardar el usuario.');
      }
    });
  };

  const handleDelete = () => {
    if (!usuario || bloqueoEliminacion) return;
    setErrorServidor(null);
    start(async () => {
      try {
        await eliminarUsuario(usuario.id);
        router.refresh();
        onClose();
      } catch (err) {
        setErrorServidor(err instanceof Error ? err.message : 'No se pudo eliminar el usuario.');
        setConfirmDelete(false);
      }
    });
  };

  const nombreCompleto = usuario ? `${usuario.nombre} ${usuario.apellido}` : '';

  const footer = confirmDelete ? (
    <>
      <p className="mr-auto text-[11px] font-medium text-danger">¿Eliminar a {nombreCompleto}? Se lo desvinculará de todas sus cátedras. No se puede deshacer.</p>
      <ModalButton onClick={() => setConfirmDelete(false)} disabled={pending}>
        No, volver
      </ModalButton>
      <ModalButton variant="danger" onClick={handleDelete} disabled={pending} autoFocus>
        {pending ? 'Eliminando…' : 'Sí, eliminar'}
      </ModalButton>
    </>
  ) : (
    <>
      {isEdit && (
        <span className="mr-auto">
          <ModalButton variant="danger-outline" onClick={() => setConfirmDelete(true)} disabled={pending || !!bloqueoEliminacion} title={bloqueoEliminacion ?? undefined}>
            Eliminar usuario
          </ModalButton>
        </span>
      )}
      <ModalButton onClick={onClose} disabled={pending}>
        Cancelar
      </ModalButton>
      <ModalButton variant="primary" type="submit" form={formId} disabled={pending}>
        {pending ? (isEdit ? 'Guardando…' : 'Creando…') : isEdit ? 'Guardar cambios' : 'Crear usuario'}
      </ModalButton>
    </>
  );

  return (
    <Modal
      open
      onClose={pending ? () => undefined : onClose}
      title={isEdit ? 'Editar usuario' : 'Nuevo usuario'}
      widthClass="max-w-2xl"
      headerExtra={
        <p className="text-xs text-muted">
          {isEdit ? `${nombreCompleto} · ${usuario?.email}` : 'La contraseña provisoria será el DNI; se pedirá cambiarla en el primer inicio de sesión.'}
        </p>
      }
      footer={footer}
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
        <fieldset disabled={pending || confirmDelete} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id={fid('nombre')} label="Nombre" error={errores.nombre}>
              <input id={fid('nombre')} value={draft.nombre} onChange={(e) => set('nombre', e.target.value)} aria-invalid={!!errores.nombre} autoFocus className={inputCls(errores.nombre)} />
            </Field>
            <Field id={fid('apellido')} label="Apellido" error={errores.apellido}>
              <input id={fid('apellido')} value={draft.apellido} onChange={(e) => set('apellido', e.target.value)} aria-invalid={!!errores.apellido} className={inputCls(errores.apellido)} />
            </Field>
            <Field id={fid('email')} label="Email institucional" error={errores.email}>
              <input
                id={fid('email')}
                type="email"
                value={draft.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="nombre@unlar.edu.ar"
                aria-invalid={!!errores.email}
                className={inputCls(errores.email)}
              />
            </Field>
            <Field id={fid('dni')} label="DNI" error={errores.dni} hint={isEdit ? undefined : 'Será la contraseña provisoria.'}>
              <input
                id={fid('dni')}
                inputMode="numeric"
                value={draft.dni}
                onChange={(e) => set('dni', e.target.value.replace(/\D/g, ''))}
                maxLength={8}
                aria-invalid={!!errores.dni}
                className={`${inputCls(errores.dni)} font-mono`}
              />
            </Field>
            <Field id={fid('rol')} label="Rol" error={errores.rol} hint={ROL_DESCRIPCION[draft.rol]}>
              <select id={fid('rol')} value={draft.rol} onChange={(e) => cambiarRol(e.target.value as Rol)} aria-invalid={!!errores.rol} className={inputCls(errores.rol)}>
                {ROLES_ORDENADOS.map((r) => (
                  <option key={r} value={r}>
                    {ROL_LABELS[r] ?? r}
                  </option>
                ))}
              </select>
            </Field>
            {draft.rol === 'DIRECCION_CARRERA' && (
              <Field id={fid('carrera')} label="Carrera que dirige" error={errores.carreraId}>
                <select id={fid('carrera')} value={draft.carreraId ?? ''} onChange={(e) => set('carreraId', e.target.value || null)} className={inputCls(errores.carreraId)}>
                  <option value="">Seleccionar carrera</option>
                  {carreras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} — {c.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          {esDocente && (
            <section aria-labelledby={fid('catedras-h')} className="space-y-3 rounded-xl border border-border bg-background p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 id={fid('catedras-h')} className="text-xs font-bold text-ink">
                  Asignación de Cátedras / Asignaturas
                </h3>
                <span className="text-[11px] text-muted">Ciclo {ciclo}</span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.6fr)_minmax(0,1.6fr)]">
                <Field id={fid('sel-carrera')} label="1. Carrera">
                  <select
                    id={fid('sel-carrera')}
                    value={selCarrera}
                    onChange={(e) => {
                      setSelCarrera(e.target.value);
                      setSelAno('ALL');
                      elegirAsignatura('');
                    }}
                    className={inputCls()}
                  >
                    <option value="">Seleccionar carrera</option>
                    {carreras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codigo} — {c.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id={fid('sel-ano')} label="Año">
                  <select
                    id={fid('sel-ano')}
                    value={selAno}
                    onChange={(e) => {
                      setSelAno(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                      elegirAsignatura('');
                    }}
                    disabled={!selCarrera}
                    className={inputCls()}
                  >
                    <option value="ALL">Todos</option>
                    {anosCarrera.map((n) => (
                      <option key={n} value={n}>
                        {n}.º año
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id={fid('sel-asig')} label="2. Asignatura / Cátedra">
                  <select
                    id={fid('sel-asig')}
                    value={asigElegida ? selAsig : ''}
                    onChange={(e) => elegirAsignatura(e.target.value)}
                    disabled={!selCarrera || asigsDisponibles.length === 0}
                    className={inputCls()}
                  >
                    <option value="">{!selCarrera ? 'Primero elegí una carrera' : asigsDisponibles.length ? 'Seleccionar asignatura' : 'Sin asignaturas disponibles'}</option>
                    {asigsDisponibles.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.anoCursada}.º · {a.nombre} ({a.regimen})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {asigElegida && (
                <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Equipo de cátedra actual · {asigElegida.nombre}</span>
                      {asigElegida.esMatricial && (
                        <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">Matricial</span>
                      )}
                    </div>
                    {asigElegida.equipo.length > 0 ? (
                      <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                        {asigElegida.equipo.map((m) => (
                          <li key={m.docenteId} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                            <span className="flex-1 truncate text-ink">{m.nombre}</span>
                            <span className="text-muted">{CARGO_LABEL[m.cargo] ?? m.cargo}</span>
                            {m.esResponsable && (
                              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Responsable</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted">La cátedra todavía no tiene integrantes.</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                    <Field id={fid('sel-cargo')} label="3. Cargo en el equipo">
                      <select
                        id={fid('sel-cargo')}
                        value={selCargo}
                        onChange={(e) => {
                          setSelCargo(e.target.value);
                          setErrores((er) => ({ ...er, nuevaCatedra: undefined }));
                        }}
                        className={inputCls()}
                      >
                        <option value="">Seleccionar cargo</option>
                        {CARGOS_CATEDRA.map((cg) => (
                          <option key={cg} value={cg}>
                            {CARGO_LABEL[cg]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs text-ink">
                      <input type="checkbox" checked={selResp} onChange={(e) => setSelResp(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
                      Responsable
                    </label>
                    <button
                      type="button"
                      onClick={incorporar}
                      className="whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-xs text-white hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      + Incorporar a la cátedra
                    </button>
                  </div>
                  {selResp && respActual && respActual.docenteId !== usuario?.id && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">Al guardar reemplazará a {respActual.nombre} como Docente Responsable.</p>
                  )}
                  {errores.nuevaCatedra && (
                    <p role="alert" className="text-[11px] text-danger">
                      {errores.nuevaCatedra}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Cátedras asignadas</span>
                  <span className="text-[11px] font-semibold text-muted">{draft.catedras.length}</span>
                </div>
                {draft.catedras.map((c) => {
                  const bloqueada = responsableGuardado.has(c.asignaturaId) || !!asigBy.get(c.asignaturaId)?.bloqueada;
                  return (
                    <div key={c.asignaturaId} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
                      <label
                        className={`flex shrink-0 items-center gap-1.5 text-xs ${bloqueada ? 'text-ink' : 'cursor-pointer text-muted'}`}
                        title={bloqueada ? 'Para cambiar el responsable o un equipo cerrado, usá Estructura Académica' : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={c.esResponsable}
                          disabled={bloqueada}
                          onChange={(e) => setCatedras((prev) => prev.map((x) => (x.asignaturaId === c.asignaturaId ? { ...x, esResponsable: e.target.checked } : x)))}
                          className="accent-primary"
                        />
                        Responsable
                      </label>
                      <span className="min-w-[9rem] flex-1 truncate text-sm text-ink">
                        {c.asignaturaNombre}
                        <span className="block text-[11px] text-muted">{c.carreraCodigo}</span>
                      </span>
                      <label className="sr-only" htmlFor={fid(`cargo-${c.asignaturaId}`)}>
                        Cargo en {c.asignaturaNombre}
                      </label>
                      <select
                        id={fid(`cargo-${c.asignaturaId}`)}
                        value={c.cargo}
                        disabled={!!asigBy.get(c.asignaturaId)?.bloqueada}
                        onChange={(e) => setCatedras((prev) => prev.map((x) => (x.asignaturaId === c.asignaturaId ? { ...x, cargo: e.target.value } : x)))}
                        className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-primary disabled:opacity-60"
                      >
                        {CARGOS_CATEDRA.map((cg) => (
                          <option key={cg} value={cg}>
                            {CARGO_LABEL[cg]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={bloqueada}
                        onClick={() => setCatedras((prev) => prev.filter((x) => x.asignaturaId !== c.asignaturaId))}
                        className="whitespace-nowrap text-xs text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:no-underline"
                        title={bloqueada ? 'Designá otro responsable en Estructura Académica antes de quitarlo' : undefined}
                      >
                        Quitar
                      </button>
                    </div>
                  );
                })}
                {draft.catedras.length === 0 && <p className="text-xs text-muted">Sin cátedras asignadas. Podés guardar así y asignarlas más tarde.</p>}
              </div>
            </section>
          )}

          {isEdit && usuario && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink">
                {usuario.mustChangePassword ? 'La cuenta usa el DNI como contraseña provisoria.' : 'La cuenta tiene una contraseña personal.'}
              </p>
              <div className="flex items-center gap-2">
                {avisoClave && (
                  <span role="status" className="text-[11px] font-medium text-success">
                    {avisoClave}
                  </span>
                )}
                <ModalButton
                  onClick={() =>
                    start(async () => {
                      try {
                        await blanquearClaveDni(usuario.id);
                        setAvisoClave('Clave blanqueada al DNI.');
                        router.refresh();
                      } catch (err) {
                        setErrorServidor(err instanceof Error ? err.message : 'No se pudo blanquear la clave.');
                      }
                    })
                  }
                >
                  Blanquear clave a DNI
                </ModalButton>
              </div>
            </div>
          )}

          {isEdit && bloqueoEliminacion && (
            <p className="text-[11px] text-muted">
              <strong className="text-ink">No se puede eliminar:</strong> {bloqueoEliminacion}
            </p>
          )}
          {errorServidor && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
              {errorServidor}
            </p>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
