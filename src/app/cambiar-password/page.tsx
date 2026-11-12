import { redirect } from 'next/navigation';

// El cambio de contraseña ahora es un modal del Header (se abre solo si `mustChangePassword` es true).
// Esta ruta se conserva para enlaces antiguos.
export default function CambiarPasswordPage() {
  redirect('/dashboard');
}
