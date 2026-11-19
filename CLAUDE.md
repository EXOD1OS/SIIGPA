# SIIGPA — DACEFyN UNLaR (Next.js 14 + Prisma + PostgreSQL + MinIO)

## Mapa de Arquitectura (Fuente de Verdad)
- **Rutas (Server Components):** `src/app/(app)/`
- **Mutaciones (Server Actions):** `src/actions/` (`planificacion`, `paad`, `admin`, `archivo`, `auth`)
- **UI Migrada (Client Components):** `src/prototipo/components/` (editores PAAC/PAAD, informes, bandejas)
- **Dashboards y Layout:** `src/components/dashboards/`, `src/components/layout/`, `src/components/admin/`
- **Adaptador Prisma <-> UI:** `src/lib/prototipo-adapter.ts` y `src/lib/prototipo-datos.ts`
- **Base de datos:** `prisma/schema.prisma` y `prisma/seed.ts`

> IMPORTANTE: No editar ni importar nada desde `_prototipo/`. Ante componentes con nombre similar en `src/components/` y `src/prototipo/components/`, verificar primero cuál está importado en `src/app/(app)/`.

## Reglas de Negocio Innegociables (Ord. HCS 171/19 y 219/22)
1. **Carreras válidas:** Solo Capital (`ISI`, `LSI`, `TUI`). Nunca incluir `TUI-CHAM`.
2. **Sin Informe General ni Anexo V:** No existe `InformeGeneralPanel` ni la vista de Anexo V en el Sidebar.
3. **PAAD Anual:** Único por docente/ciclo (Puntos 1 al 8, incluido `8) Distribución Horaria`). Aspectos Generales dinámicos por cátedra. Queda `APROBADO` con dictamen de **UAP o Dirección** (no requiere ambos).
4. **PAAC e Informes:** Solo se aprueban desde adentro del PAAC (UAP solo ve Pedagógico; Dirección solo ve Disciplinar). En `/planificaciones`, `InformesModal` es estrictamente solo lectura.
5. **Protocolización en 2 instancias (Consejo):**
   - Etapa 1 (`APROBADO_PLENO` -> `ELEVADO_AL_CONSEJO`): carga solo `expediente`.
   - Etapa 2 (`ELEVADO_AL_CONSEJO` -> `FINALIZADO`): carga `resolucion`, consolida PDF en MinIO/S3 y bloquea el documento de forma **inmutable**.

## Convenciones de UI y Verificación
- Usar tokens semánticos de `tailwind.config.ts` (`bg-background`, `bg-surface`, `text-ink`, `text-muted`, `border-border`, `bg-primary`, `bg-soft`) compatibles con modo claro/oscuro.
- Tablas de bandejas siempre con `table-fixed` y anchos porcentuales que sumen 100%.
- Etiquetas cortas de observaciones: `Observaciones: X`.
- **Antes de dar por terminada cualquier tarea:** ejecutar `npx tsc --noEmit`. Si se modifica `prisma/schema.prisma`, avisar para correr `npx prisma db push`.