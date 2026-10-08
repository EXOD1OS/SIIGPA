# SIGA-Planificaciones

Sistema de Gestión de Planificaciones Docentes PAAC/PAAD — Departamento Académico de Ciencias Exactas,
Físicas y Naturales (DACEFyN), UNLaR. Implementa el circuito de la Ord. HCS 171/2019, Ord. HCS 219/2022 y
Ord. HCS 448/2011.

## Stack

- Next.js 14 (App Router) + TypeScript
- PostgreSQL + Prisma ORM (JSONB para PAAC/PAAD dinámicos)
- Tailwind CSS (tema Dark Slate institucional)
- Redux Toolkit (estado de UI: ciclo/carrera seleccionados, documento activo, observaciones)
- NextAuth (credenciales + bcrypt) para autenticación por rol

## Puesta en marcha

1. Copiar variables de entorno:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Levantar PostgreSQL (requiere Docker Desktop corriendo):

   ```powershell
   docker compose up -d
   ```

3. Instalar dependencias, generar el cliente Prisma, migrar y sembrar datos de prueba:

   ```powershell
   npm install
   npx prisma migrate dev --name init
   npm run prisma:seed
   ```

4. Iniciar el servidor de desarrollo:

   ```powershell
   npm run dev
   ```

5. Abrir http://localhost:3000 — todos los usuarios de prueba usan la contraseña `unlar2026`:

   | Email                         | Rol                     |
   | ------------------------------ | ------------------------ |
   | admin@unlar.edu.ar             | Administrador             |
   | direccion.isi@unlar.edu.ar     | Dirección de Carrera (ISI) |
   | uap@unlar.edu.ar               | UAP                        |
   | consejo.exactas@unlar.edu.ar   | Consejo Departamental       |
   | titular.prog@unlar.edu.ar      | Docente Responsable         |
   | auxiliar.prog@unlar.edu.ar     | Docente Auxiliar            |

   El seed también carga el relevamiento de cátedras de ISI: 59 materias, docentes, asignaciones y
   planificaciones en borrador para el ciclo 2026. Las cuentas importadas usan el formato
   `nombre.apellido@unlar.edu.ar`, la contraseña
   inicial `unlar2026` y deben cambiarla al ingresar. El relevamiento no informa año, régimen, carga horaria
   ni responsable, por lo que esos campos quedan como `A DEFINIR` y no se generan PAAC incompletos.

## Circuito de estados

```
BORRADOR → ENVIADO_A_REVISION → (UAP / Dirección evalúan)
  → OBSERVADO (con fallas, vuelve a BORRADOR)
  → APROBADO_PEDAGOGICO / APROBADO_DISCIPLINAR → APROBADO_PLENO
  → ELEVADO_AL_CONSEJO (nota de elevación de Dirección)
  → FINALIZADO (Consejo Departamental asigna expediente y resolución)
```

- **Docente Responsable**: completa el PAAC (Anexo II), invita al equipo docente y envía a revisión cuando
  todos los PAAD (Anexo III) fueron presentados.
- **Docente Auxiliar**: completa su propio PAAD.
- **UAP**: emite el Informe Pedagógico (Anexo III, Ord. 219/22); puede observar campos puntuales del PAAC/PAAD.
- **Dirección de Carrera**: emite el Informe Disciplinar (Anexo IV) y, una vez con aprobación plena, eleva al
  Consejo Departamental (Anexo II).
- **Consejo Departamental**: formaliza con número de expediente y resolución, cerrando el ciclo.
- **Administrador**: crea las planificaciones de cada ciclo lectivo y siembra la estructura académica.

## Notas

- Los formularios PAAC/PAAD se persisten como JSON (`datosPaac`, `datosPaad`) en PostgreSQL, siguiendo la
  estructura tipada en [`src/types/planificacion.ts`](src/types/planificacion.ts).
- Las observaciones de campo (`ItemObservacion`) quedan ancladas a un `campoPath` (ej.
  `metodologiaEvaluacion.regimenAprobacion.regular`) y se resuelven desde el propio campo en el formulario.
- `npm run db:reset` reinicia la base y vuelve a sembrar los datos de prueba.
