# Registro de cambios

## Pendiente de publicar

- Se incorporó una instalación Docker portable para SIGA, con aplicación Next.js, PostgreSQL y migraciones automáticas.
- La demostración solo se carga en una base del dominio completamente vacía; las bases existentes se conservan.
- Se añadió el perfil opcional de MinIO AIStor, que prepara un bucket privado y una cuenta S3 limitada sin incluir licencias ni credenciales en el repositorio.
- Se añadieron archivos de ejemplo, comprobaciones de configuración, un iniciador para Windows y la guía de instalación y actualización.
- Se fijó la compilación Linux de PDFKit y se excluyeron configuraciones, volúmenes y resultados locales del contexto de construcción.
- **Migración UI Etapa 1 (prototipo SIIGPA):** tokens de tema claro/oscuro como variables CSS (`globals.css`, `tailwind.config.ts`) con `ThemeProvider` persistido en `localStorage` (`siigpa.theme`) y script anti-parpadeo en `app/layout.tsx`.
- Login rediseñado (`login/page.tsx`, `login-form.tsx`, `shared/UnlarLogo.tsx`) con fondo de campus, tarjeta glassmorphism y botón de tema, conectado a `signIn('credentials')`; `lib/auth.ts` acepta correo o DNI y relee `mustChangePassword` en `update()`.
- Cambio de contraseña como modal (`shared/CambiarPasswordModal.tsx`) sobre la nueva Server Action `cambiarPasswordAction` (valida la contraseña actual, mínimo 8 caracteres); se abre desde el menú de perfil y de forma obligatoria si `mustChangePassword`. `/cambiar-password` redirige y se eliminó `CambiarPasswordForm.tsx`.
- Nuevo `layout/Header.tsx` y `Sidebar.tsx` (contraíble, `next/link` + `usePathname`) integrados en `(app)/layout.tsx`; "Normativa vigente" enlaza solo a Ord. HCS 171/2019 y 219/2022. `_prototipo` excluido de `tsconfig.json`.
- **Migración UI Etapa 2:** dashboards de Inicio por rol en `src/components/dashboards/` (`DashboardKit`, `Docente/Uap/Direccion/ConsejoDashboardView`, `DashboardInicio`) con donas SVG, KPIs uniformes, matriz PAAC/PAAD por carrera y tarjetas clickeables; datos reales vía `lib/dashboard-datos.ts` y deep-linking `router.push('/planificaciones|/paads?careerId=&state=…')`.
- `StatusBadge.tsx` y `ESTADO_LABELS` unificados con el prototipo ("En revisión", "Observado" + "Observaciones pendientes", PAAC "Presentado"/"Correcciones"); helpers `dictamenesPaac`, `etapaPaac` y `progresoSecciones` en `types/planificacion.ts`.
- `PlanificacionesList.tsx` y nuevo `PaadsList.tsx` con `table-fixed` y anchos fijos, filtros iniciales desde `useSearchParams()`; sin "Esperando Resolución" en `ELEVADO_AL_CONSEJO`; la bandeja de PAAD solo ofrece "Ver PAAD".
- Aprobación simple del PAAD en `lib/paad.ts` (`operarPaad`): un dictamen favorable de UAP o de la Dirección pasa a `APROBADO`; se ajustó `tests/paad-integracion.ts`.
- **Migración UI Etapa 3:** se eliminó el Informe General (`InformeGeneralPanel.tsx`, `guardarInformeGeneral`, requisito de `elevarAlConsejo`, pestaña y archivado en `lib/archivo-expediente.ts`); quedan solo los informes Pedagógico (UAP) y Disciplinar (Dirección).
- Informes oficiales Ord. 219/22 (`types/informes.ts`, `lib/informes.ts`, `lib/informes-servidor.ts`, `components/informes/*`): emisión solo desde `/planificaciones/[id]` y solo el informe del rol (`EvaluacionInforme`), autocompletado desde `datosPaac` y los `PaadAnual`; `InformesModal` de solo lectura en la bandeja con «Ver PDF», «Descargar PDF» y «← Volver a vista digital».
- PAAD: Aspectos Generales dinámicos por cátedra (`lib/paad-encabezado.ts`, `PaadEncabezadoDinamico`, `?asignatura=`), hoja oficial `PaadDocumentoOficial` + `PaadModal` con «8) DISTRIBUCIÓN HORARIA» y apartados numerados «1)…8)» en `PaadForm`.
- `eliminarObservacionAction` en `planificacion.actions.ts` y `paad.actions.ts` (solo el área autora o Administración; no en PAAC FINALIZADO / PAAD APROBADO); botón «Eliminar» en `ObservationFieldWrapper` y `PanelRevision` con «Enviar con revisiones» (ámbar) y «Aprobar…» (esmeralda).
- **Migración UI Etapa 4:** protocolización del Consejo en 2 instancias (`BotonProtocolo`, `ProtocolizacionModal` con stepper): `registrarExpedienteAction` (APROBADO_PLENO → ELEVADO_AL_CONSEJO, nuevo campo `fechaElevacion` + migración `20261112000000_protocolizacion_dos_instancias`) y `registrarResolucionAction` (→ FINALIZADO, con `consolidarYSubirExpediente` solo si S3/MinIO está configurado); se quitaron `elevarAlConsejo`, `asignarExpediente` y `formalizarResolucion`. El Consejo ahora ve los PAAC en APROBADO_PLENO.
- Inmutabilidad en ELEVADO_AL_CONSEJO/FINALIZADO en Server Actions (`requireEstadoEditable`, `eliminarObservacionAction`) y en la UI (aviso de solo lectura, sin eliminar/subsanar); `archivo.actions.ts` agrega `consolidarExpedienteAction` para regenerar el expediente PDF de una planificación finalizada.
- Administración rediseñada (`AdminEstructuraView`, `CarreraDetalleModal`, `EquipoCatedraModal` sin columna «Estado PAAD», `TreeItem`, `AdminUsuariosView`, `UsuarioFormModal`) sobre nuevas acciones `guardarEquipoCatedra`, `sincronizarCatedrasUsuario`, `actualizarUsuario`, `blanquearClaveDni` y `eliminarUsuario`; `crearUsuario` ya no devuelve el registro con el hash de la contraseña. Se eliminaron `EstructuraExplorer`, `EquipoCatedraPanel`, `UsuariosPanel` y `CrearUsuarioForm`.
- **Despliegue:** la columna `Planificacion.fechaElevacion` requiere aplicar la migración `20261112000000_protocolizacion_dos_instancias` con `prisma migrate deploy` (no `db push`, para conservar el historial). Docker ya la aplica al iniciar (`docker/iniciar-app.sh`, antes de `preparar-base.ts`).


### Migración y Modernización de Interfaces (UI/UX)

- **Adaptación visual de prototipos (`context/`):**
  - Modernización del cascarón general (`Sidebar.tsx`, layouts de navegación) alineado al prototipo integral institucional.
  - Refactorización de formularios modulares PAAC (Anexo II) y PAAD interactivo (Anexo III) adoptando las estructuras visuales de los prototipos en `context/`.
  - Actualización de vistas de dictamen y actas de evaluación para los Informes Pedagógicos (UAP) e Informes Disciplinares (Dirección de Carrera).
  - Rediseño de la bandeja de planificaciones (`PlanificacionesList.tsx`, `planificaciones/page.tsx`): panel único con barra de filtros responsiva (búsqueda, ciclo lectivo, sede, período, carrera y estado), tabla semántica con cabeceras alineadas y cifras tabulares en pantallas medianas y grandes, y tarjetas verticales en móviles sin desplazamiento horizontal. Se conservan los filtros, la paginación, el ciclo seleccionado en Redux, `StatusBadge` y la consulta de expediente (`ResolucionModal`) del docente.
- **Preservación estricta de lógica y auditoría:**
  - Se mantuvo intacta la persistencia de datos dinámicos JSONB (`datosPaac` y `datosPaad`) y el tipado institucional.
  - Conservación del sistema atómico de observaciones (`ItemObservacion`) mediante `ObservationFieldWrapper`, asegurando el anclaje a las rutas jerárquicas de campo (`campoPath`).
  - Integración nativa con Server Actions (`planificacion.actions.ts`, `paad.actions.ts`, `archivo.actions.ts`) y Redux Toolkit sin pérdida de estado.
- **Sistema de diseño:**
  - Estandarización de componentes sobre el tema institucional **Dark Slate** con Tailwind CSS (`background: #0c0f17`, `surface: #161b26`, `border: #262e40`) y componentes reutilizables (`StatusBadge`, `StatusTimeline`, modales).