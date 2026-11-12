'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { cambiarPasswordAction } from '@/actions/auth.actions';
import { IconAlert, IconCheck, IconEye, IconEyeOff, IconKey } from '@/components/layout/icons';

interface Props {
  open: boolean;
  /** Nombre y perfil de la sesión activa (ej. "Lucía Torres"). */
  activeUserName: string;
  rolLabel: string;
  /** La cuenta todavía usa el DNI como contraseña provisoria: no se puede cerrar sin cambiarla. */
  obligatorio?: boolean;
  onClose: () => void;
  /** Se llama después de que la Server Action confirmó el cambio. */
  onSuccess: () => void | Promise<void>;
  /** Solo en modo obligatorio: permite salir de la cuenta en lugar de cambiar la contraseña. */
  onLogout?: () => void;
}

const MIN = 8;

const inputCls =
  'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 pr-11 text-sm text-ink placeholder:text-muted outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--primary)_30%,transparent)] focus:border-primary transition-all duration-200 aria-[invalid=true]:border-danger';

function CampoPassword({
  id,
  label,
  value,
  onChange,
  autoComplete,
  ayuda,
  error,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  ayuda?: string;
  error?: string;
  autoFocus?: boolean;
}) {
  const [ver, setVer] = useState(false);
  const describedBy = [ayuda && `${id}-ayuda`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={ver ? 'text' : 'password'}
          value={value}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          aria-label={ver ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={ver}
          className="absolute inset-y-0 right-1 my-1 flex w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-soft hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {ver ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
        </button>
      </div>
      {ayuda && !error && (
        <p id={`${id}-ayuda`} className="mt-1 text-[11px] text-muted">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="animate-fadeIn mt-1 text-[11px] font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/** Cambio de contraseña sin salir de la vista en la que se trabaja. */
export function CambiarPasswordModal({ open, activeUserName, rolLabel, obligatorio = false, onClose, onSuccess, onLogout }: Props) {
  const uid = useId();
  const cerrarRef = useRef<() => void>(onClose);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [intento, setIntento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [errorServidor, setErrorServidor] = useState<{ campo?: 'actual' | 'nueva'; msg: string } | null>(null);

  // En modo obligatorio (o mientras se guarda) el modal no se puede cerrar.
  const cerrable = !obligatorio && !enviando;
  const cerrar = () => {
    if (cerrable) onClose();
  };

  useEffect(() => {
    cerrarRef.current = cerrar;
  });

  // Al abrir: formulario limpio, Escape cierra y el fondo no se desplaza.
  useEffect(() => {
    if (!open) return;
    setActual('');
    setNueva('');
    setConfirmacion('');
    setIntento(false);
    setEnviando(false);
    setListo(false);
    setErrorServidor(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cerrarRef.current();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  // Los errores se muestran al primer intento de guardar y después se actualizan mientras se escribe.
  const errores = {
    actual: !actual ? 'Ingresá tu contraseña actual o el DNI inicial.' : undefined,
    nueva:
      nueva.length < MIN
        ? `La nueva contraseña debe tener al menos ${MIN} caracteres.`
        : nueva === actual
          ? 'La nueva contraseña debe ser distinta de la actual.'
          : undefined,
    confirmacion: !confirmacion ? 'Repetí la nueva contraseña.' : confirmacion !== nueva ? 'Las contraseñas no coinciden.' : undefined,
  };
  const valido = !errores.actual && !errores.nueva && !errores.confirmacion;
  const ver = (e?: string) => (intento ? e : undefined);
  const errorDe = (campo: 'actual' | 'nueva') => ver(errores[campo]) ?? (errorServidor?.campo === campo ? errorServidor.msg : undefined);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setIntento(true);
    setErrorServidor(null);
    if (!valido || enviando) return;
    setEnviando(true);
    try {
      const res = await cambiarPasswordAction(actual, nueva);
      if (!res.ok) {
        setErrorServidor({ campo: res.campo, msg: res.error });
        setEnviando(false);
        return;
      }
      setListo(true);
      await onSuccess();
    } catch {
      setErrorServidor({ msg: 'No se pudo guardar la contraseña. Intentá nuevamente.' });
    }
    setEnviando(false);
  };

  return (
    <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={cerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-titulo`}
        aria-describedby={`${uid}-sub`}
        className="animate-riseIn w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-soft text-primary">
            <IconKey className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`${uid}-titulo`} className="text-sm font-semibold text-ink">
              Cambiar Contraseña
            </h2>
            <p id={`${uid}-sub`} className="truncate text-[11px] text-muted">
              {activeUserName} · {rolLabel}
            </p>
          </div>
          {!obligatorio && (
            <button
              type="button"
              onClick={cerrar}
              disabled={enviando}
              aria-label="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
            >
              ✕
            </button>
          )}
        </div>

        {listo ? (
          <div role="status" className="flex flex-col items-center gap-3 px-5 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <IconCheck className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-ink">Contraseña actualizada</p>
            <p className="text-xs text-muted">Usá tu nueva contraseña en el próximo ingreso.</p>
            {!obligatorio && (
              <button
                type="button"
                onClick={onClose}
                className="mt-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Listo
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={guardar} noValidate className="space-y-4 px-5 py-5">
            {obligatorio && (
              <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
                <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Tu cuenta usa el DNI como contraseña provisoria. Definí una contraseña personal para continuar de forma segura.
              </p>
            )}
            <CampoPassword
              id={`${uid}-actual`}
              label="Contraseña actual / DNI inicial"
              value={actual}
              onChange={(v) => {
                setActual(v);
                if (errorServidor?.campo === 'actual') setErrorServidor(null);
              }}
              autoComplete="current-password"
              error={errorDe('actual')}
              autoFocus
            />
            <CampoPassword
              id={`${uid}-nueva`}
              label="Nueva contraseña"
              value={nueva}
              onChange={(v) => {
                setNueva(v);
                if (errorServidor?.campo === 'nueva') setErrorServidor(null);
              }}
              autoComplete="new-password"
              ayuda={`Mínimo ${MIN} caracteres.`}
              error={errorDe('nueva')}
            />
            <CampoPassword
              id={`${uid}-confirmar`}
              label="Confirmar nueva contraseña"
              value={confirmacion}
              onChange={setConfirmacion}
              autoComplete="new-password"
              error={ver(errores.confirmacion)}
            />

            {errorServidor && !errorServidor.campo && (
              <p role="alert" className="animate-fadeIn rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                {errorServidor.msg}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              {obligatorio ? (
                onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    disabled={enviando}
                    className="rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-medium text-danger transition-colors hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                  >
                    Cerrar sesión
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={cerrar}
                  disabled={enviando}
                  className="rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-medium text-ink transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={enviando || (intento && !valido)}
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
