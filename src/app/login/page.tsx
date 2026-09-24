'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordChanged = searchParams.get('passwordChanged') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError('Credenciales inválidas.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-white">SIGA Planificaciones</h1>
          <p className="text-sm text-gray-400 mt-1">DACEFyN &middot; UNLaR</p>
        </div>

        {passwordChanged && (
          <p className="text-sm text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2 mb-4">
            Contraseña actualizada. Ingresá con tus nuevas credenciales.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email institucional</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
              placeholder="usuario@unlar.edu.ar"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-hover transition-colors rounded-lg py-2 text-white font-medium disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 text-xs text-gray-500 border-t border-border pt-4">
          <p className="font-medium text-gray-400 mb-1">Usuarios de prueba (seed):</p>
          <p>admin@unlar.edu.ar &middot; direccion.isi@unlar.edu.ar</p>
          <p>uap@unlar.edu.ar &middot; consejo.exactas@unlar.edu.ar</p>
          <p>titular.prog@unlar.edu.ar &middot; auxiliar.prog@unlar.edu.ar</p>
          <p className="mt-1">Contraseña: unlar2026</p>
        </div>
      </div>
    </div>
  );
}
