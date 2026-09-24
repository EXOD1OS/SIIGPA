'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/Modal';
import { ROL_LABELS } from '@/types/planificacion';

export interface UsuarioMateria {
  nombre: string;
  categoria: string;
  cicloLectivo: number;
}

export interface UsuarioRow {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  rol: string;
  carrera: string | null;
  materias: UsuarioMateria[];
}

export function UsuariosPanel({ usuarios }: { usuarios: UsuarioRow[] }) {
  const [query, setQuery] = useState('');
  const [seleccionado, setSeleccionado] = useState<UsuarioRow | null>(null);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) =>
      [u.nombre, u.apellido, u.email, u.dni, ROL_LABELS[u.rol] ?? u.rol].some((v) => v.toLowerCase().includes(q))
    );
  }, [usuarios, query]);

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Buscar por nombre, apellido, email, DNI o rol..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full"
      />

      <div className="border border-border rounded-xl overflow-hidden bg-surface divide-y divide-border">
        <div className="grid grid-cols-12 px-5 py-3 text-xs text-gray-500 uppercase tracking-wide">
          <span className="col-span-3">Nombre</span>
          <span className="col-span-3">Email</span>
          <span className="col-span-2">DNI</span>
          <span className="col-span-2">Rol</span>
          <span className="col-span-2">Carrera</span>
        </div>
        {filtrados.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setSeleccionado(u)}
            className="grid grid-cols-12 items-center px-5 py-3 text-sm text-left hover:bg-background/60 transition-colors w-full"
          >
            <span className="col-span-3 text-gray-200 truncate">
              {u.nombre} {u.apellido}
            </span>
            <span className="col-span-3 text-gray-400 truncate">{u.email}</span>
            <span className="col-span-2 text-gray-400">{u.dni}</span>
            <span className="col-span-2 text-gray-400">{ROL_LABELS[u.rol] ?? u.rol}</span>
            <span className="col-span-2 text-gray-400">{u.carrera ?? '—'}</span>
          </button>
        ))}
        {filtrados.length === 0 && <p className="px-5 py-6 text-sm text-gray-500">No se encontraron usuarios.</p>}
      </div>

      <Modal
        open={!!seleccionado}
        onClose={() => setSeleccionado(null)}
        title={seleccionado ? `${seleccionado.nombre} ${seleccionado.apellido}` : ''}
        widthClass="max-w-lg"
      >
        {seleccionado && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-gray-200">{seleccionado.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">DNI</p>
                <p className="text-gray-200">{seleccionado.dni}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Rol asignado</p>
                <p className="text-gray-200">{ROL_LABELS[seleccionado.rol] ?? seleccionado.rol}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Carrera</p>
                <p className="text-gray-200">{seleccionado.carrera ?? '—'}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Materias que dicta</p>
              {seleccionado.materias.length === 0 ? (
                <p className="text-xs text-gray-600">Sin materias asignadas en el equipo de cátedra.</p>
              ) : (
                <div className="space-y-1.5">
                  {seleccionado.materias.map((m, i) => (
                    <div key={i} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                      <span className="text-gray-200">{m.nombre}</span>
                      <span className="text-xs text-gray-500">
                        {m.categoria} &middot; Ciclo {m.cicloLectivo}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
