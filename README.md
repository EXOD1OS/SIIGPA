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

**Opción recomendada: Docker completo.** La guía de [instalación y actualización con Docker](docs/DOCKER.md)
levanta SIGA y PostgreSQL, y permite habilitar MinIO AIStor con licencia externa. No requiere Node instalado
en la PC. Conserva los volúmenes y aplica las migraciones al iniciar. La carga de demostración solo se
ejecuta sobre una base completamente vacía cuando `DEMO_SEED_IF_EMPTY=true`.
En Windows, luego de preparar la configuración privada, se puede iniciar con `INICIAR_DEMO.cmd`; acepta una
ruta alternativa al archivo de configuración y `--minio` cuando AIStor ya tiene licencia configurada.

Los pasos siguientes son la alternativa de desarrollo con Node 20 o posterior en la PC y solo PostgreSQL
en Docker. No habilitan el perfil `minio`; para almacenar PDF, configurar un servicio S3 por separado o
seguir la guía completa.

1. Copiar variables de entorno:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Levantar PostgreSQL (requiere Docker Engine en ejecución; Docker Desktop es opcional si usas el Engine de WSL):

   ```powershell
   docker compose up -d db
   ```

3. Instalar dependencias, generar el cliente Prisma, migrar y sembrar datos de prueba:

   ```powershell
   npm install
   npm run prisma:generate
   npx prisma migrate deploy
   npm run prisma:seed
   ```

4. Iniciar el servidor de desarrollo:

   ```powershell
   npm run dev
   ```

5. Abrir http://localhost:3000 — todos los usuarios de prueba usan la contraseña `unlar2026`:

   | Email                                                                                                                                           | Rol                                                   |
   | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
   | admin@unlar.edu.ar                                                                                                                              | Administrador                                         |
   | uap@unlar.edu.ar                                                                                                                                | UAP                                                   |
   | direccion.isi@unlar.edu.ar                                                                                                                      | Dirección de Carrera (ISI)                            |
   | direccion.lsi@unlar.edu.ar                                                                                                                      | Dirección de Carrera (LSI)                            |
   | direccion.tui@unlar.edu.ar                                                                                                                      | Dirección de Carrera (TUI)                            |
   | consejo.exactas@unlar.edu.ar                                                                                                                    | Consejo Departamental                                 |
   | titular.prog@unlar.edu.ar                                                                                                                       | Docente (Lucía Torres, responsable de Programación I) |
   | auxiliar.prog@unlar.edu.ar                                                                                                                      | Docente (Martín López, debe cambiar la contraseña)    |
   | sofia.romero@unlar.edu.ar, diego.castro@unlar.edu.ar, mariana.lastra@unlar.edu.ar, eduardo.campazzo@unlar.edu.ar, alejandra.guzman@unlar.edu.ar | Docentes                                              |

   El seed **reinicia la base** y carga exactamente los datos ficticios de `src/prototipo/data/mockData.ts`
   (copia de `_prototipo/src/data/mockData.ts`): carreras ISI, LSI y TUI de Sede Capital y un PAAC por cada
   estado del circuito (borrador, en revisión, observado, aprobado pedagógico/disciplinar/pleno, elevado al
   Consejo y finalizado), además de PAAD en borrador, en revisión, observado y aprobado.

   Para otros ciclos, Administración puede iniciar el ciclo desde Gestión Académica. La acción copia
   automáticamente los equipos del ciclo anterior y crea los borradores faltantes; no modifica el historial
   ni las planificaciones existentes.
   También puede ejecutarse con `npm run prisma:planificaciones -- 2027` usando la base configurada
   en `DATABASE_URL`, sin reiniciar ni sembrar de nuevo la base.

## Circuito de estados

```
BORRADOR → ENVIADO_A_REVISION → (UAP / Dirección evalúan)
  → OBSERVADO (con fallas, vuelve a BORRADOR)
  → APROBADO_PEDAGOGICO / APROBADO_DISCIPLINAR → APROBADO_PLENO
  → ELEVADO_AL_CONSEJO (nota de elevación de Dirección)
  → FINALIZADO (Consejo Departamental asigna expediente y resolución)
```

- **Docente Responsable**: completa el PAAC (Anexo II), invita al equipo y envía a revisión independientemente
  de la presentación de los PAAD personales. Consulta el estado del equipo en «Equipo y PAAD».
- **Todos los docentes**: completan un único PAAD por año desde «Mi PAAD». Guardar borrador y presentar
  son acciones separadas. El mismo documento se consulta desde todas sus materias del ciclo.
- **UAP**: emite el Informe Pedagógico (Anexo III, Ord. 219/22); puede observar campos puntuales del PAAC/PAAD.
- **Dirección de Carrera**: emite el Informe Disciplinar (Anexo IV) y, una vez con aprobación plena, eleva al
  Consejo Departamental (Anexo II).
- **Consejo Departamental**: formaliza con número de expediente y resolución, cerrando el ciclo.
- **Administrador**: crea las planificaciones de cada ciclo lectivo y siembra la estructura académica.

## Archivado de documentos PDF

Al formalizar el expediente y pasar la planificación a `FINALIZADO`, la aplicación genera y archiva el PAAC,
cada PAAD anual aprobado de los docentes del equipo y los tres informes (Pedagógico, Disciplinar y General)
en un almacenamiento privado compatible con S3, como MinIO AIStor. Los PAAD que no estén aprobados se
omiten y no impiden finalizar la planificación. El estado final solo se registra si el almacenamiento y el
índice de archivos en PostgreSQL se completan correctamente.

Configura en `.env.local` las variables `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` y
`S3_SECRET_ACCESS_KEY`. Crea previamente el bucket y asigna al usuario de la aplicación permisos de listar
el bucket y leer/subir objetos dentro de él. No uses la cuenta root de MinIO desde la aplicación ni guardes
credenciales en Git. `S3_ENDPOINT` debe ser accesible desde el servidor Next.js; al mover MinIO a otro
servidor o usar otro servicio compatible con S3, se cambia la configuración y no el flujo de la aplicación.
Las descargas pasan por una ruta autenticada de la aplicación y no requieren exponer el bucket públicamente.

`EXPEDIENTE_PDF_TIPOS` permite elegir qué documentos archivar, separado por comas: `PAAC`, `PAAD`,
`INFORME_PEDAGOGICO`, `INFORME_DISCIPLINAR` e `INFORME_GENERAL`. Si no se define, se archivan todos.
Los archivos y su checksum quedan indexados en PostgreSQL; el contenido binario permanece en el bucket.

## PAAD personal y actualización de bases existentes

El PAAD tiene revisión propia: borrador → enviado a revisión → aprobado por UAP/Dirección → aprobado.
Una observación devuelve únicamente el PAAD al docente. El docente corrige, marca las observaciones
resueltas y vuelve a presentar. Cada presentación conserva una copia inmutable y necesita las dos
conformidades de esa presentación. El PAAD aprobado queda de solo lectura y no tiene elevación al Consejo.
Los PAAD pendientes u observados no bloquean el PAAC, su aprobación ni su expediente.

UAP revisa todos los PAAD; una única Dirección es responsable de cada documento anual. Si el docente
tiene una sola carrera evaluadora, se asigna automáticamente; si tiene varias o ninguna, Administración
la selecciona en la bandeja «PAAD» antes de la presentación. Las otras direcciones vinculadas solo consultan.

Para actualizar una base que ya tiene información, detener la app y hacer un respaldo antes de ejecutar:

```powershell
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:paad:migrar
npm run dev
```

Estos comandos usan la base configurada. El conversor carga las variables locales igual que Next.js.
Las copias antiguas y sus observaciones se conservan como antecedentes de solo lectura. Las copias
iguales se unifican; las distintas quedan bloqueadas hasta que Administración compare y elija una
fuente en la bandeja «PAAD». El conversor puede repetirse sin duplicar documentos ni observaciones.
Las aprobaciones antiguas de materias no se interpretan como aprobaciones personales.
**No ejecutar db:reset ni el seed para actualizar una base existente:** ambos eliminan los datos. El seed
borra todo el dominio antes de cargar la demostración; con `NODE_ENV=production` rechaza una base con
registros salvo que se indique `SEED_RESET=true`. Docker solo lo ejecuta sobre una base vacía.

## Comprobaciones de la separación PAAC/PAAD

```powershell
npm run test:paad
# Usar exclusivamente una base aislada cuyo nombre incluya _qa_ o _vacia_:
$env:PAAD_TEST_DATABASE_URL = "postgresql://usuario:clave@localhost:5432/siga_qa_paad?schema=public"
npm run test:paad:integracion
npm run lint
npx tsc --noEmit --incremental false
# Compilar sin sobrescribir la carpeta del servidor de desarrollo:
$env:NEXT_BUILD_DIR = ".next-qa-build"
npm run build
Remove-Item Env:NEXT_BUILD_DIR
```

Las pruebas de integración crean fixtures en la base aislada y no reinician ninguna base.
Incluyen permisos, observaciones, snapshots, dictámenes concurrentes, conflictos e idempotencia.
El detalle de las comprobaciones y recorridos está en
[Validación PAAC/PAAD](docs/VALIDACION_PAAC_PAAD_20261008.md).

## Notas

- Los formularios PAAC/PAAD se persisten como JSON (`datosPaac`, `datosPaad`) en PostgreSQL, siguiendo la
  estructura tipada en [`src/types/planificacion.ts`](src/types/planificacion.ts).
- Las observaciones de campo (`ItemObservacion`) quedan ancladas a un `campoPath` (ej.
  `metodologiaEvaluacion.regimenAprobacion.regular`) y se resuelven desde el propio campo en el formulario.
- `npm run db:reset` reinicia la base y vuelve a sembrar los datos de prueba.
