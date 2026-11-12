'use server';

import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Debe coincidir con `MIN` de `CambiarPasswordModal` (un archivo 'use server' solo puede exportar funciones async).
const PASSWORD_MIN = 8;

export type CambiarPasswordResult = { ok: true } | { ok: false; campo?: 'actual' | 'nueva'; error: string };

/**
 * Cambio de contraseña desde el modal del Header: valida la contraseña actual (o el DNI inicial),
 * guarda la nueva y libera la marca `mustChangePassword`.
 */
export async function cambiarPasswordAction(actual: string, nueva: string): Promise<CambiarPasswordResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: 'Tu sesión expiró. Volvé a ingresar.' };
  if (!actual) return { ok: false, campo: 'actual', error: 'Ingresá tu contraseña actual o el DNI inicial.' };
  if (nueva.length < PASSWORD_MIN)
    return { ok: false, campo: 'nueva', error: `La nueva contraseña debe tener al menos ${PASSWORD_MIN} caracteres.` };
  if (nueva === actual) return { ok: false, campo: 'nueva', error: 'La nueva contraseña debe ser distinta de la actual.' };

  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
  if (!usuario) return { ok: false, error: 'No encontramos tu cuenta.' };

  const valida = await bcrypt.compare(actual, usuario.passwordHash);
  if (!valida) return { ok: false, campo: 'actual', error: 'La contraseña actual no es correcta.' };

  const passwordHash = await bcrypt.hash(nueva, 10);
  await prisma.usuario.update({
    where: { id: session.user.id },
    data: { passwordHash, mustChangePassword: false },
  });
  return { ok: true };
}
