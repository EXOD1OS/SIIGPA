'use client';

import { useId, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { IconArrowRight, IconCheck, IconEye, IconEyeOff, IconLock, IconMoon, IconSun, IconUser } from '@/components/layout/icons';
import { UnlarLogo } from '@/components/shared/UnlarLogo';
import { useTheme } from '@/components/theme/ThemeProvider';

// `primary`, `surface`, `background`, `soft` y `border` son variables CSS sin canal alfa: los modificadores
// `/NN` de Tailwind no se generan para ellas. Junto a cada uno va su equivalente literal con color-mix.
const inputCls = [
  'w-full rounded-xl hover:bg-background focus:bg-surface border border-border focus:border-primary',
  'focus:ring-4 bg-[color:color-mix(in_srgb,var(--bg)_80%,transparent)] focus:ring-[color:color-mix(in_srgb,var(--primary)_15%,transparent)]',
  'pl-10 pr-3.5 py-2.5 text-xs text-ink placeholder:text-muted outline-none transition-all duration-200',
  'aria-[invalid=true]:border-danger',
].join(' ');
const iconoCampoCls = 'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-primary';
const labelCls = 'mb-1.5 block text-xs font-semibold text-ink';

type ErrorLogin = { campo: 'usuario' | 'password' | 'general'; msg: string };

export default function LoginForm({ callbackUrl, passwordChanged }: { callbackUrl: string; passwordChanged: boolean }) {
  const router = useRouter();
  const uid = useId();
  const { isDark, toggleTheme } = useTheme();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<ErrorLogin | null>(null);
  const [loading, setLoading] = useState(false);
  const [fondoListo, setFondoListo] = useState(false);

  async function ingresar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const clave = usuario.trim();
    if (!clave) return setError({ campo: 'usuario', msg: 'Ingresá tu correo institucional o tu DNI.' });
    if (!password) return setError({ campo: 'password', msg: 'Ingresá tu contraseña.' });

    setError(null);
    setLoading(true);
    try {
      const result = await signIn('credentials', { email: clave, password, redirect: false, callbackUrl });
      if (!result || result.error) {
        setError({ campo: 'general', msg: 'No pudimos validar esos datos. Revisá el correo/DNI y la contraseña.' });
        setLoading(false);
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError({ campo: 'general', msg: 'No se pudo conectar con el sistema. Intentá nuevamente.' });
      setLoading(false);
    }
  }

  const errorId = `${uid}-error`;
  const descr = (campo: 'usuario' | 'password') => (error && (error.campo === campo || error.campo === 'general') ? errorId : undefined);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- fondo decorativo con transición de carga */}
      <img
        src="/unlar-campus-login.png"
        alt=""
        aria-hidden
        onLoad={() => setFondoListo(true)}
        ref={(img) => {
          if (img?.complete && !fondoListo) setFondoListo(true);
        }}
        className={`absolute inset-0 h-full w-full scale-105 object-cover transition-[transform,opacity] duration-1000 ${fondoListo ? 'opacity-100' : 'scale-110 opacity-0'}`}
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-tr from-slate-950/85 via-slate-900/75 to-[#157b79]/50 backdrop-blur-[4px]" />

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        title={isDark ? 'Modo claro' : 'Modo oscuro'}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white backdrop-blur-md transition-colors duration-200 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {isDark ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
      </button>

      <main className="animate-riseIn relative z-10 w-full max-w-[420px] overflow-hidden rounded-3xl border bg-[color:color-mix(in_srgb,var(--surface)_95%,transparent)] border-[color:color-mix(in_srgb,var(--border)_80%,transparent)] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-300">
        <div aria-hidden className="h-1.5 w-full bg-gradient-to-r from-primary via-emerald-500 to-primary" />

        <header className="space-y-3 px-8 pb-4 pt-8 text-center">
          <UnlarLogo className="mx-auto h-16 transition-transform duration-300 hover:scale-105" />
          <span className="inline-flex items-center rounded-full border border-[color:color-mix(in_srgb,var(--primary)_20%,transparent)] bg-soft px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
            DACEFyN · UNLaR
          </span>
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink">SIIGPA</h1>
            <p className="text-xs leading-relaxed text-muted">Sistema Integral de Gestión de Planificaciones Académicas</p>
          </div>
        </header>

        <form onSubmit={ingresar} noValidate className="space-y-5 px-8 pb-8 pt-2">
          {passwordChanged && (
            <p role="status" className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Contraseña actualizada. Ingresá con tus nuevas credenciales.
            </p>
          )}

          <div>
            <label htmlFor={`${uid}-usuario`} className={labelCls}>
              Correo Institucional o DNI
            </label>
            <div className="group relative">
              <IconUser className={iconoCampoCls} />
              <input
                id={`${uid}-usuario`}
                name="email"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="email"
                placeholder="nombre@unlar.edu.ar"
                value={usuario}
                onChange={(e) => {
                  setUsuario(e.target.value);
                  if (error?.campo !== 'password') setError(null);
                }}
                aria-invalid={error?.campo === 'usuario' || error?.campo === 'general'}
                aria-describedby={descr('usuario')}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label htmlFor={`${uid}-password`} className={labelCls}>
              Contraseña
            </label>
            <div className="group relative">
              <IconLock className={iconoCampoCls} />
              <input
                id={`${uid}-password`}
                name="password"
                type={verPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error?.campo !== 'usuario') setError(null);
                }}
                aria-invalid={error?.campo === 'password' || error?.campo === 'general'}
                aria-describedby={descr('password')}
                className={`${inputCls} pr-24`}
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                aria-pressed={verPassword}
                aria-controls={`${uid}-password`}
                className="absolute inset-y-0 right-1.5 my-1.5 flex items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-muted transition-colors hover:bg-soft hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {verPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                {verPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {error && (
            <p id={errorId} role="alert" className="animate-fadeIn rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
              {error.msg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-semibold tracking-wide text-white shadow-lg shadow-[color:color-mix(in_srgb,var(--primary)_25%,transparent)] transition-all duration-200 hover:bg-primary-hover hover:shadow-xl hover:shadow-[color:color-mix(in_srgb,var(--primary)_30%,transparent)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? (
              <>
                <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Verificando acceso…
              </>
            ) : (
              <>
                Iniciar Sesión
                <IconArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <footer className="border-t border-border bg-[color:color-mix(in_srgb,var(--bg)_60%,transparent)] px-8 py-4 text-center">
          <p className="text-[11px] text-muted">Acceso inicial con número de DNI · Ordenanzas HCS N° 171/19 y 219/22</p>
        </footer>
      </main>
    </div>
  );
}
