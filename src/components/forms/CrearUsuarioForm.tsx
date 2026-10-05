'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { crearUsuario } from '@/actions/admin.actions';
import { ROL_LABELS } from '@/types/planificacion';
import { TextField, SelectField, SectionCard } from './fields';

const ROLES = Object.values(UserRole);

export function CrearUsuarioForm({ carreras }: { carreras: { id: string; nombre: string; codigo: string }[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [dni, setDni] = useState('');
  const [rol, setRol] = useState<UserRole>(UserRole.DOCENTE);
  const [carreraId, setCarreraId] = useState(carreras[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await crearUsuario({
        nombre,
        apellido,
        email,
        dni,
        rol,
        carreraId: rol === UserRole.DIRECCION_CARRERA ? carreraId : null,
      });
      setSuccess(`Usuario creado. Contraseña temporal: el DNI (${dni}).`);
      setNombre('');
      setApellido('');
      setEmail('');
      setDni('');
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? 'No se pudo crear el usuario.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard title="Nuevo usuario">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Nombre" value={nombre} onChange={setNombre} />
          <TextField label="Apellido" value={apellido} onChange={setApellido} />
          <TextField label="Email institucional" value={email} onChange={setEmail} />
          <TextField label="DNI" value={dni} onChange={setDni} />
          <SelectField
            label="Rol"
            value={rol}
            options={ROLES.map((r) => ({ value: r, label: ROL_LABELS[r] ?? r }))}
            onChange={(v) => setRol(v as UserRole)}
          />
          {rol === UserRole.DIRECCION_CARRERA && (
            <SelectField
              label="Carrera"
              value={carreraId}
              options={carreras.map((c) => ({ value: c.id, label: `${c.nombre} (${c.codigo})` }))}
              onChange={setCarreraId}
            />
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {success && <p className="text-sm text-success">{success}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-primary hover:bg-primary-hover transition-colors text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? 'Creando...' : 'Crear usuario'}
        </button>
      </form>
    </SectionCard>
  );
}
